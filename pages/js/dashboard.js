// C:\Project\barakah_finance2\pages\js\dashboard.js

(function () {
    'use strict';

    const DEBUG = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // ── Check if DB is available ──
    function isDBAvailable() {
        return typeof DB !== 'undefined' && DB !== null;
    }

    // ── Toast function ──
    function toast(msg, color = '#065F46') {
        const existing = document.querySelector('.toast');
        if (existing) existing.remove();

        const t = document.createElement('div');
        t.className = 'toast';
        t.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: ${color};
            color: #fff;
            padding: 12px 20px;
            border-radius: 10px;
            font-size: 13px;
            z-index: 99999;
            font-family: 'Noto Serif Bengali', serif;
            animation: slideUp 0.3s ease;
            display: block;
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

    // ── Ensure animation exists ──
    (function ensureToastAnimation() {
        if (!document.querySelector('style[data-dash-toast]')) {
            const style = document.createElement('style');
            style.dataset.dashToast = '1';
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

    // ── State ──
    let currentUser = null;
    let activePanel = '';

    // ════════ INIT ════════

    document.addEventListener('DOMContentLoaded', function () {
        if (!isDBAvailable()) {
            alert('ডাটাবেস লোড হয়নি। পৃষ্ঠা রিফ্রেশ করুন।');
            window.location.href = '../index.html';
            return;
        }

        currentUser = DB.getSession();
        if (!currentUser || !currentUser.verified) {
            alert('দয়া করে প্রথমে লগইন করুন।');
            window.location.href = '../index.html';
            return;
        }

        initDashboard();
    });

    function initDashboard() {
        try {
            // Update sidebar user info
            const avatarEl = document.getElementById('sb-avatar');
            const nameEl = document.getElementById('sb-name');
            if (avatarEl) avatarEl.textContent = (currentUser.name || 'ব')[0];
            if (nameEl) nameEl.textContent = currentUser.name || 'ব্যবহারকারী';

            // Update profile completion
            const pct = calcProfileComplete();
            const pctEl = document.getElementById('sb-complete-pct');
            const fillEl = document.getElementById('sb-complete-fill');
            if (pctEl) pctEl.textContent = pct + '%';
            if (fillEl) fillEl.style.width = pct + '%';

            // Update role badge
            const roleBadge = document.getElementById('sb-role-badge');
            if (roleBadge) {
                const roleMap = { admin: 'অ্যাডমিন', member: 'সদস্য', customer: 'গ্রাহক', user: 'ব্যবহারকারী' };
                const roleClass = { admin: 'role-admin', member: 'role-member', customer: 'role-customer', user: 'role-customer' };
                roleBadge.textContent = roleMap[currentUser.role] || 'ব্যবহারকারী';
                roleBadge.className = 'sb-role ' + (roleClass[currentUser.role] || 'role-customer');
            }

            buildNav();
            showPanel('panel-overview');

            if (DEBUG) console.log('[Dashboard] Initialized for:', currentUser.name);

        } catch (error) {
            console.error('[Dashboard] Init error:', error);
            toast('ড্যাশবোর্ড লোড করতে সমস্যা', '#e53e3e');
        }
    }

    // ════════ SIDEBAR NAV ════════

    function buildNav() {
        const nav = document.getElementById('sb-nav');
        if (!nav) return;

        const common = [
            { id: 'panel-overview', icon: '📊', label: 'ওভারভিউ' },
            { id: 'panel-profile', icon: '👤', label: 'আমার প্রোফাইল' },
            { id: 'panel-orders', icon: '🛒', label: 'আমার অর্ডার' }
        ];

        const member = [
            { id: 'panel-savings', icon: '💰', label: 'সঞ্চয় বিবরণ' },
            { id: 'panel-loans', icon: '🤝', label: 'করজে হাসানা' }
        ];

        const admin = [
            { id: 'panel-admin', icon: '🛡️', label: 'অ্যাডমিন প্যানেল' },
            { id: 'panel-all-users', icon: '👥', label: 'সকল ব্যবহারকারী' },
            { id: 'panel-all-savings', icon: '💰', label: 'সঞ্চয় হিসাব' },
            { id: 'panel-all-loans', icon: '🤝', label: 'করজে হাসানা' }
        ];

        let html = '<div class="sb-section">মূল মেনু</div>';

        common.forEach(item => {
            html += `<a class="sb-item" data-panel="${item.id}" onclick="showPanel('${item.id}')">
                <span class="icon">${item.icon}</span>${item.label}
            </a>`;
        });

        if (currentUser.role === 'member' || currentUser.role === 'admin') {
            html += '<div class="sb-section">সদস্য সেবা</div>';
            member.forEach(item => {
                html += `<a class="sb-item" data-panel="${item.id}" onclick="showPanel('${item.id}')">
                    <span class="icon">${item.icon}</span>${item.label}
                </a>`;
            });
        }

        if (currentUser.role === 'admin') {
            html += '<div class="sb-section">অ্যাডমিন</div>';
            admin.forEach(item => {
                html += `<a class="sb-item" data-panel="${item.id}" onclick="showPanel('${item.id}')">
                    <span class="icon">${item.icon}</span>${item.label}
                </a>`;
            });
            html += `<a class="sb-item" href="../admin/admin.html"><span class="icon">📋</span>সদস্য আবেদন</a>`;
            html += `<a class="sb-item" href="../admin/shop_admin.html"><span class="icon">🏬</span>শপ অ্যাডমিন</a>`;
        }

        nav.innerHTML = html;
    }

    // ════════ PANEL SWITCHING ════════

    function showPanel(id) {
        try {
            // Update panels
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.sb-item').forEach(b => b.classList.remove('active'));

            const panel = document.getElementById(id);
            if (panel) panel.classList.add('active');

            const navItem = document.querySelector(`.sb-item[data-panel="${id}"]`);
            if (navItem) navItem.classList.add('active');

            activePanel = id;

            // Update title
            const titles = {
                'panel-overview': 'ওভারভিউ',
                'panel-savings': 'সঞ্চয় বিবরণ',
                'panel-loans': 'করজে হাসানা',
                'panel-orders': 'আমার অর্ডার',
                'panel-profile': 'প্রোফাইল',
                'panel-admin': 'অ্যাডমিন প্যানেল',
                'panel-all-users': 'সকল ব্যবহারকারী',
                'panel-all-savings': 'সঞ্চয় হিসাব',
                'panel-all-loans': 'করজে হাসানা'
            };

            const titleEl = document.getElementById('topbar-title');
            if (titleEl) titleEl.textContent = titles[id] || 'ড্যাশবোর্ড';

            closeSidebar();

            // Load panel content
            const loaders = {
                'panel-overview': loadOverview,
                'panel-savings': loadSavings,
                'panel-loans': loadLoans,
                'panel-orders': loadOrders,
                'panel-profile': loadProfile,
                'panel-admin': loadAdminPanel,
                'panel-all-users': renderAllUsers,
                'panel-all-savings': loadAllSavings,
                'panel-all-loans': loadAllLoans
            };

            if (loaders[id]) loaders[id]();

        } catch (error) {
            console.error('[Dashboard] Show panel error:', error);
            toast('প্যানেল লোড করতে সমস্যা', '#e53e3e');
        }
    }

    // ════════ OVERVIEW ════════

    function loadOverview() {
        try {
            const savings = DB.getSavings().filter(s => s.userId === currentUser.id);
            const loans = DB.getLoans().filter(l => l.userId === currentUser.id);
            const orders = DB.getOrders().filter(o => o.customerPhone === currentUser.phone);
            const totalSavings = savings.reduce((sum, s) => sum + (s.amount || 0), 0);
            const activeLoans = loans.filter(l => l.status === 'active');
            const pct = calcProfileComplete();

            const isAdmin = currentUser.role === 'admin';
            const allSavings = DB.getSavings();
            const allUsers = DB.getUsers().filter(u => u.verified);
            const allOrders = DB.getOrders();

            // Stats
            const statsEl = document.getElementById('overview-stats');
            if (statsEl) {
                if (isAdmin) {
                    const totalSavingsAll = allSavings.reduce((sum, s) => sum + (s.amount || 0), 0);
                    statsEl.innerHTML = `
                        <div class="stat-card"><div class="sc-icon sc-green">👥</div><div class="sc-val">${toBengaliNum(allUsers.length)}</div><div class="sc-lbl">মোট ব্যবহারকারী</div></div>
                        <div class="stat-card"><div class="sc-icon sc-gold">💰</div><div class="sc-val">৳${toBengaliNum(totalSavingsAll.toLocaleString())}</div><div class="sc-lbl">মোট সঞ্চয়</div></div>
                        <div class="stat-card"><div class="sc-icon sc-blue">🛒</div><div class="sc-val">${toBengaliNum(allOrders.length)}</div><div class="sc-lbl">মোট অর্ডার</div></div>
                        <div class="stat-card"><div class="sc-icon sc-red">🤝</div><div class="sc-val">${toBengaliNum(DB.getLoans().filter(l => l.status === 'active').length)}</div><div class="sc-lbl">সক্রিয় করজ</div></div>
                    `;
                } else {
                    statsEl.innerHTML = `
                        <div class="stat-card"><div class="sc-icon sc-green">💰</div><div class="sc-val">৳${toBengaliNum(totalSavings.toLocaleString())}</div><div class="sc-lbl">মোট সঞ্চয়</div></div>
                        <div class="stat-card"><div class="sc-icon sc-gold">📅</div><div class="sc-val">${toBengaliNum(savings.length)}</div><div class="sc-lbl">সঞ্চয় এন্ট্রি</div></div>
                        <div class="stat-card"><div class="sc-icon sc-blue">🤝</div><div class="sc-val">${toBengaliNum(activeLoans.length)}</div><div class="sc-lbl">সক্রিয় করজ</div></div>
                        <div class="stat-card"><div class="sc-icon sc-red">🛒</div><div class="sc-val">${toBengaliNum(orders.length)}</div><div class="sc-lbl">আমার অর্ডার</div></div>
                        <div class="stat-card"><div class="sc-icon sc-green">✅</div><div class="sc-val">${toBengaliNum(pct)}%</div><div class="sc-lbl">প্রোফাইল সম্পন্নতা</div></div>
                    `;
                }
            }

            // Chart
            const months = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date();
                d.setMonth(d.getMonth() - i);
                months.push({
                    key: d.toISOString().slice(0, 7),
                    label: d.toLocaleDateString('bn-BD', { month: 'short' })
                });
            }

            const chartData = months.map(m => {
                const data = isAdmin ? DB.getSavings().filter(s => s.month === m.key) : savings.filter(s => s.month === m.key);
                return {
                    label: m.label,
                    val: data.reduce((sum, s) => sum + (s.amount || 0), 0)
                };
            });

            const maxVal = Math.max(...chartData.map(d => d.val), 1);
            const chartEl = document.getElementById('savings-chart');

            if (chartEl) {
                chartEl.innerHTML = chartData.map(d => `
                    <div class="savings-bar-wrap">
                        <div class="savings-bar" style="height:${Math.max(4, (d.val / maxVal * 100))}px;" title="৳${d.val.toLocaleString()}"></div>
                        <div class="savings-bar-lbl">${d.label}</div>
                    </div>
                `).join('');
            }

            // Recent activity
            const activities = [];
            savings.slice(-3).reverse().forEach(s => {
                activities.push({ icon: '💰', text: `সঞ্চয়: ৳${(s.amount || 0).toLocaleString()}`, date: s.date });
            });
            orders.slice(-2).reverse().forEach(o => {
                activities.push({ icon: '🛒', text: `অর্ডার: ${o.productName || '—'}`, date: o.submittedAt });
            });

            const actEl = document.getElementById('recent-activity');
            if (actEl) {
                actEl.innerHTML = activities.length ? activities.map(a => `
                    <div style="display:flex;gap:10px;padding:8px 0;border-bottom:1px solid #f0f4f1;">
                        <span>${a.icon}</span>
                        <div>
                            <div style="font-size:13px;">${a.text}</div>
                            <div style="font-size:11px;color:var(--text-muted);">${a.date ? formatDate(a.date) : ''}</div>
                        </div>
                    </div>
                `).join('') : '<div style="color:var(--text-muted);font-size:13px;padding:12px 0;">কোনো কার্যক্রম নেই</div>';
            }

        } catch (error) {
            console.error('[Dashboard] Load overview error:', error);
            toast('ওভারভিউ লোড করতে সমস্যা', '#e53e3e');
        }
    }

    function formatDate(iso) {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleDateString('bn-BD');
        } catch {
            return '—';
        }
    }

    // ════════ PROFILE COMPLETION ════════

    function calcProfileComplete() {
        return calcProfileCompleteFor(currentUser);
    }

    function calcProfileCompleteFor(user) {
        if (!user) return 0;
        const fields = [
            user.name, user.phone, user.email, user.dob,
            user.occupation || user.job, user.address,
            user.nid, user.username
        ];
        const filled = fields.filter(f => f && f.toString().trim().length > 0).length;
        return Math.round((filled / fields.length) * 100);
    }

    // ════════ SAVINGS ════════

    function loadSavings() {
        try {
            const savings = DB.getSavings().filter(s => s.userId === currentUser.id);
            const total = savings.reduce((sum, s) => sum + (s.amount || 0), 0);

            const badgeEl = document.getElementById('savings-total-badge');
            if (badgeEl) badgeEl.textContent = `মোট: ৳${total.toLocaleString('bn')}`;

            const table = document.getElementById('savings-table');
            if (!table) return;

            if (!savings.length) {
                table.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:20px;">কোনো সঞ্চয় এন্ট্রি নেই</td></tr>';
                return;
            }

            table.innerHTML = savings.slice().reverse().map((s, i) => `
                <tr>
                    <td>${toBengaliNum(savings.length - i)}</td>
                    <td>${s.month || '—'}</td>
                    <td style="color:var(--dark-green);font-weight:700;">৳${(s.amount || 0).toLocaleString('bn')}</td>
                    <td>${formatDate(s.date)}</td>
                    <td><span class="tag tag-ok">✅ জমা</span></td>
                </tr>
            `).join('');

        } catch (error) {
            console.error('[Dashboard] Load savings error:', error);
            toast('সঞ্চয় লোড করতে সমস্যা', '#e53e3e');
        }
    }

    // ════════ LOANS ════════

    function loadLoans() {
        try {
            const loans = DB.getLoans().filter(l => l.userId === currentUser.id);
            const table = document.getElementById('loans-table');
            if (!table) return;

            if (!loans.length) {
                table.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:20px;">কোনো করজ নেই</td></tr>';
                return;
            }

            const statusMap = {
                active: '<span class="tag tag-pend">চলমান</span>',
                paid: '<span class="tag tag-ok">পরিশোধিত</span>',
                pending: '<span class="tag tag-blue">পেন্ডিং</span>',
                rejected: '<span class="tag tag-no">বাতিল</span>'
            };

            table.innerHTML = loans.slice().reverse().map(l => `
                <tr>
                    <td style="font-size:11px;color:#888;">${l.id}</td>
                    <td>৳${(l.amount || 0).toLocaleString('bn')}</td>
                    <td>৳${(l.remaining || l.amount || 0).toLocaleString('bn')}</td>
                    <td>${l.reason || '—'}</td>
                    <td>${statusMap[l.status] || l.status}</td>
                    <td>${formatDate(l.createdAt)}</td>
                </tr>
            `).join('');

        } catch (error) {
            console.error('[Dashboard] Load loans error:', error);
            toast('করজ লোড করতে সমস্যা', '#e53e3e');
        }
    }

    function submitLoan() {
        try {
            const amount = parseFloat(document.getElementById('loan-amount').value);
            const reason = document.getElementById('loan-reason').value.trim();
            const start = document.getElementById('loan-start').value;

            if (!amount || !reason || !start) {
                toast('সকল প্রয়োজনীয় তথ্য পূরণ করুন।', '#e53e3e');
                return;
            }

            if (amount > 15000) {
                toast('সর্বোচ্চ ১৫,০০০ টাকা আবেদন করা যাবে।', '#e53e3e');
                return;
            }

            const loans = DB.getLoans();
            loans.push({
                id: DB.genID('LOAN'),
                userId: currentUser.id,
                userName: currentUser.name,
                amount: amount,
                remaining: amount,
                reason: reason,
                guarantor: document.getElementById('loan-guarantor').value.trim(),
                startMonth: start,
                months: 3,
                status: 'pending',
                createdAt: new Date().toISOString()
            });

            DB.set(DB.KEYS.LOANS, loans);
            loadLoans();
            toast('করজে হাসানা আবেদন জমা হয়েছে! ✅');

            ['loan-amount', 'loan-reason', 'loan-start', 'loan-guarantor'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });

        } catch (error) {
            console.error('[Dashboard] Submit loan error:', error);
            toast('আবেদন জমা দিতে সমস্যা', '#e53e3e');
        }
    }

    // ════════ ORDERS ════════

    function loadOrders() {
        try {
            const orders = DB.getOrders().filter(o =>
                o.customerPhone === currentUser.phone || o.nid === currentUser.nid
            );

            const table = document.getElementById('orders-table');
            if (!table) return;

            const ORDER_STEPS = ['আবেদন জমা', 'কমিটি পর্যালোচনা', 'অনুমোদন', 'পণ্য সংগ্রহ', 'বিতরণ', 'সম্পন্ন'];
            const statusMap = {
                pending: '<span class="tag tag-pend">পেন্ডিং</span>',
                approved: '<span class="tag tag-ok">অনুমোদিত</span>',
                rejected: '<span class="tag tag-no">বাতিল</span>',
                processing: '<span class="tag tag-blue">প্রসেসিং</span>',
                delivered: '<span class="tag tag-ok">বিতরিত</span>'
            };

            if (!orders.length) {
                table.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#aaa;padding:20px;">কোনো অর্ডার নেই</td></tr>';
                return;
            }

            table.innerHTML = orders.slice().reverse().map(o => `
                <tr>
                    <td style="font-size:11px;color:#888;">${o.id}</td>
                    <td>${o.productName || '—'}</td>
                    <td>৳${(o.price || 0).toLocaleString('bn')}</td>
                    <td>৳${(o.perInstall || 0).toLocaleString('bn')} × ৬</td>
                    <td style="font-size:12px;">${ORDER_STEPS[o.statusStep || 0]}</td>
                    <td>${statusMap[o.status] || o.status}</td>
                    <td>${formatDate(o.submittedAt)}</td>
                </tr>
            `).join('');

        } catch (error) {
            console.error('[Dashboard] Load orders error:', error);
            toast('অর্ডার লোড করতে সমস্যা', '#e53e3e');
        }
    }

    // ════════ PROFILE ════════

    function loadProfile() {
        try {
            const user = currentUser;

            // Map fields
            const fieldMap = {
                'pf-name': user.name,
                'pf-uname': user.username,
                'pf-phone': user.phone,
                'pf-email': user.email,
                'pf-dob': user.dob,
                'pf-job': user.occupation || user.job,
                'pf-address': user.address,
                'pf-nid': user.nid
            };

            for (const [id, value] of Object.entries(fieldMap)) {
                const el = document.getElementById(id);
                if (el) el.value = value || '';
            }

            // Referral
            const refEl = document.getElementById('pf-referral');
            if (refEl) {
                if (user.referral) {
                    const ref = DB.getUsers().find(u => u.id === user.referral);
                    refEl.value = ref ? ref.name : user.referral;
                } else {
                    refEl.value = 'নেই';
                }
            }

            // Profile completion ring
            const pct = calcProfileComplete();
            const ringNum = document.getElementById('ring-num');
            const ringProg = document.getElementById('ring-progress');

            if (ringNum) ringNum.textContent = pct + '%';
            if (ringProg) {
                const circumference = 251.2;
                ringProg.style.strokeDashoffset = circumference - (circumference * pct / 100);
            }

            // Display info
            const nameDisplay = document.getElementById('profile-name-display');
            const roleDisplay = document.getElementById('profile-role-display');
            const idDisplay = document.getElementById('profile-id-display');

            const roleMap = { admin: 'অ্যাডমিন', member: 'সদস্য', user: 'ব্যবহারকারী', customer: 'গ্রাহক' };
            if (nameDisplay) nameDisplay.textContent = user.name || '—';
            if (roleDisplay) roleDisplay.textContent = roleMap[user.role] || user.role;
            if (idDisplay) idDisplay.textContent = user.memberID ? `সদস্য আইডি: ${user.memberID}` : `আইডি: ${user.id.slice(0, 12)}`;

            // Checklist
            const checkItems = [
                { label: 'নাম', done: !!user.name },
                { label: 'মোবাইল', done: !!user.phone },
                { label: 'ইমেইল', done: !!user.email },
                { label: 'জন্ম তারিখ', done: !!user.dob },
                { label: 'পেশা', done: !!(user.occupation || user.job) },
                { label: 'ঠিকানা', done: !!user.address },
                { label: 'এনআইডি', done: !!user.nid }
            ];

            const checkEl = document.getElementById('completion-checklist');
            if (checkEl) {
                checkEl.innerHTML = checkItems.map(c => `
                    <div style="display:flex;align-items:center;gap:8px;padding:5px 0;">
                        <span>${c.done ? '✅' : '⬜'}</span>
                        <span style="color:${c.done ? 'var(--dark-green)' : 'var(--text-muted)'};">${c.label}</span>
                    </div>
                `).join('');
            }

        } catch (error) {
            console.error('[Dashboard] Load profile error:', error);
            toast('প্রোফাইল লোড করতে সমস্যা', '#e53e3e');
        }
    }

    function saveProfile() {
        try {
            const users = DB.getUsers();
            const idx = users.findIndex(u => u.id === currentUser.id);

            if (idx < 0) {
                toast('ব্যবহারকারী পাওয়া যায়নি।', '#e53e3e');
                return;
            }

            const newPass = document.getElementById('pf-pass').value;

            if (newPass) {
                if (newPass.length < 8 || !/[a-zA-Z]/.test(newPass) || !/[0-9]/.test(newPass)) {
                    toast('পাসওয়ার্ড ৮+ অক্ষর, সংখ্যা ও লেটার থাকতে হবে।', '#e53e3e');
                    return;
                }
                users[idx].password = newPass;
            }

            users[idx].name = document.getElementById('pf-name').value.trim() || users[idx].name;
            users[idx].email = document.getElementById('pf-email').value.trim() || users[idx].email;
            users[idx].dob = document.getElementById('pf-dob').value;
            users[idx].occupation = document.getElementById('pf-job').value.trim();
            users[idx].address = document.getElementById('pf-address').value.trim();
            users[idx].nid = document.getElementById('pf-nid').value.trim();
            users[idx].profileComplete = calcProfileCompleteFor(users[idx]);

            DB.saveUsers(users);
            currentUser = users[idx];
            DB.setSession(currentUser);

            loadProfile();
            toast('প্রোফাইল সংরক্ষিত হয়েছে ✅');

            document.getElementById('pf-pass').value = '';

        } catch (error) {
            console.error('[Dashboard] Save profile error:', error);
            toast('প্রোফাইল সংরক্ষণে সমস্যা', '#e53e3e');
        }
    }

    // ════════ ADMIN PANEL ════════

    function loadAdminPanel() {
        try {
            const apps = DB.getApplications ? DB.getApplications() : DB.get(DB.KEYS.APPS) || [];
            const products = DB.getProducts();
            const orders = DB.getOrders();
            const users = DB.getUsers().filter(u => u.verified);
            const savings = DB.getSavings();
            const loans = DB.getLoans();

            // Stats
            const stats = [
                { id: 'aq-apps', value: `${toBengaliNum(apps.length)} টি আবেদন` },
                { id: 'aq-products', value: `${toBengaliNum(products.length)} টি পণ্য` },
                { id: 'aq-orders', value: `${toBengaliNum(orders.length)} টি অর্ডার` },
                { id: 'aq-users', value: `${toBengaliNum(users.length)} জন` },
                { id: 'aq-savings', value: `৳${toBengaliNum(savings.reduce((sum, s) => sum + (s.amount || 0), 0).toLocaleString())}` },
                { id: 'aq-loans', value: `${toBengaliNum(loans.filter(l => l.status === 'active').length)} টি সক্রিয়` }
            ];

            for (const stat of stats) {
                const el = document.getElementById(stat.id);
                if (el) el.textContent = stat.value;
            }

            // Admin stats
            const adminStats = document.getElementById('admin-stats');
            if (adminStats) {
                const totalOutstanding = loans.filter(l => l.status === 'active')
                    .reduce((sum, l) => sum + (l.remaining || l.amount || 0), 0);

                adminStats.innerHTML = `
                    <div class="stat-card"><div class="sc-icon sc-green">👥</div><div class="sc-val">${toBengaliNum(users.length)}</div><div class="sc-lbl">মোট ব্যবহারকারী</div></div>
                    <div class="stat-card"><div class="sc-icon sc-gold">📋</div><div class="sc-val">${toBengaliNum(apps.filter(a => a.status === 'pending').length)}</div><div class="sc-lbl">পেন্ডিং আবেদন</div></div>
                    <div class="stat-card"><div class="sc-icon sc-blue">🛒</div><div class="sc-val">${toBengaliNum(orders.filter(o => o.status === 'pending').length)}</div><div class="sc-lbl">পেন্ডিং অর্ডার</div></div>
                    <div class="stat-card"><div class="sc-icon sc-red">🤝</div><div class="sc-val">৳${toBengaliNum(totalOutstanding.toLocaleString())}</div><div class="sc-lbl">মোট করজ বাকি</div></div>
                `;
            }

            // Recent applications
            const table = document.getElementById('admin-recent-apps');
            if (!table) return;

            const recentApps = apps.slice().reverse().slice(0, 5);
            const statusMap = {
                pending: '<span class="tag tag-pend">পেন্ডিং</span>',
                approved: '<span class="tag tag-ok">অনুমোদিত</span>',
                rejected: '<span class="tag tag-no">বাতিল</span>'
            };

            if (!recentApps.length) {
                table.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:16px;">কোনো আবেদন নেই</td></tr>';
                return;
            }

            table.innerHTML = recentApps.map(a => `
                <tr>
                    <td>${a.applicantNameBn || '—'}</td>
                    <td style="font-size:12px;">${a.nidNumber || '—'}</td>
                    <td style="font-size:12px;">${(a.phones || [])[0] || '—'}</td>
                    <td>${statusMap[a.status] || a.status}</td>
                    <td style="font-size:12px;">${formatDate(a.submittedAt)}</td>
                </tr>
            `).join('');

        } catch (error) {
            console.error('[Dashboard] Load admin panel error:', error);
            toast('অ্যাডমিন প্যানেল লোড করতে সমস্যা', '#e53e3e');
        }
    }

    // ════════ ALL USERS ════════

    function renderAllUsers() {
        if (currentUser.role !== 'admin') {
            toast('শুধুমাত্র অ্যাডমিনের অ্যাক্সেস আছে', '#e53e3e');
            return;
        }

        try {
            const search = (document.getElementById('user-search')?.value || '').toLowerCase();
            let users = DB.getUsers();

            if (search) {
                users = users.filter(u =>
                    (u.name || '').toLowerCase().includes(search) ||
                    (u.phone || '').includes(search) ||
                    (u.username || '').toLowerCase().includes(search)
                );
            }

            const table = document.getElementById('all-users-table');
            if (!table) return;

            const roleMap = { admin: 'অ্যাডমিন', member: 'সদস্য', user: 'ব্যবহারকারী', customer: 'গ্রাহক' };
            const roleClass = { admin: 'tag-pend', member: 'tag-ok', user: 'tag-blue', customer: 'tag-blue' };

            if (!users.length) {
                table.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#aaa;padding:20px;">কোনো ব্যবহারকারী নেই</td></tr>';
                return;
            }

            table.innerHTML = users.map(u => `
                <tr>
                    <td>${u.name || '—'}</td>
                    <td><code>${u.username || '—'}</code></td>
                    <td>${u.phone || '—'}</td>
                    <td>${u.email || '—'}</td>
                    <td><span class="tag ${roleClass[u.role] || 'tag-blue'}">${roleMap[u.role] || u.role}</span></td>
                    <td>
                        <div class="prog-bar" style="width:80px;">
                            <div class="prog-fill" style="width:${u.profileComplete || 0}%"></div>
                        </div>
                        <span style="font-size:10px;color:#888;">${u.profileComplete || 0}%</span>
                    </td>
                    <td>
                        <select onchange="changeUserRole('${u.id}',this.value)" style="font-size:11px;padding:3px;border:1px solid #d1fae5;border-radius:4px;">
                            <option value="user" ${u.role === 'user' ? 'selected' : ''}>ব্যবহারকারী</option>
                            <option value="customer" ${u.role === 'customer' ? 'selected' : ''}>গ্রাহক</option>
                            <option value="member" ${u.role === 'member' ? 'selected' : ''}>সদস্য</option>
                            <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>অ্যাডমিন</option>
                        </select>
                    </td>
                </tr>
            `).join('');

        } catch (error) {
            console.error('[Dashboard] Render all users error:', error);
            toast('ব্যবহারকারী লোড করতে সমস্যা', '#e53e3e');
        }
    }

    function changeUserRole(userId, newRole) {
        try {
            const users = DB.getUsers();
            const idx = users.findIndex(u => u.id === userId);

            if (idx >= 0) {
                users[idx].role = newRole;
                DB.saveUsers(users);

                // Update current user if changed
                if (currentUser.id === userId) {
                    currentUser.role = newRole;
                    DB.setSession(currentUser);
                }

                toast('ভূমিকা পরিবর্তন হয়েছে ✅');
                renderAllUsers();
            }

        } catch (error) {
            console.error('[Dashboard] Change user role error:', error);
            toast('ভূমিকা পরিবর্তনে সমস্যা', '#e53e3e');
        }
    }

    // ════════ ALL SAVINGS ════════

    function loadAllSavings() {
        if (currentUser.role !== 'admin') {
            toast('শুধুমাত্র অ্যাডমিনের অ্যাক্সেস আছে', '#e53e3e');
            return;
        }

        try {
            const users = DB.getUsers().filter(u => u.verified && u.role !== 'admin');
            const select = document.getElementById('sv-user');

            if (select) {
                select.innerHTML = '<option value="">-- সদস্য নির্বাচন --</option>' +
                    users.map(u => `<option value="${u.id}">${u.name} (${u.phone})</option>`).join('');
            }

            renderSavingsTable();

        } catch (error) {
            console.error('[Dashboard] Load all savings error:', error);
            toast('সঞ্চয় লোড করতে সমস্যা', '#e53e3e');
        }
    }

    function renderSavingsTable() {
        try {
            const savings = DB.getSavings();
            const users = DB.getUsers();
            const total = savings.reduce((sum, s) => sum + (s.amount || 0), 0);

            const badgeEl = document.getElementById('total-savings-badge');
            if (badgeEl) badgeEl.textContent = `মোট: ৳${total.toLocaleString('bn')}`;

            const table = document.getElementById('all-savings-table');
            if (!table) return;

            if (!savings.length) {
                table.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:20px;">কোনো সঞ্চয় নেই</td></tr>';
                return;
            }

            table.innerHTML = savings.slice().reverse().map(s => {
                const user = users.find(u => u.id === s.userId);
                return `
                    <tr>
                        <td>${user ? user.name : '—'}</td>
                        <td>${s.month || '—'}</td>
                        <td>৳${(s.amount || 0).toLocaleString('bn')}</td>
                        <td>${s.note || '—'}</td>
                        <td>${formatDate(s.date)}</td>
                        <td>
                            <button onclick="deleteSaving('${s.id}')" style="background:#fee2e2;border:none;padding:3px 8px;border-radius:4px;cursor:pointer;font-size:11px;color:#991b1b;">🗑️</button>
                        </td>
                    </tr>
                `;
            }).join('');

        } catch (error) {
            console.error('[Dashboard] Render savings table error:', error);
            toast('সঞ্চয় টেবিল লোড করতে সমস্যা', '#e53e3e');
        }
    }

    function addSavingEntry() {
        try {
            const userId = document.getElementById('sv-user')?.value;
            const month = document.getElementById('sv-month')?.value;
            const amount = parseFloat(document.getElementById('sv-amount')?.value);
            const note = document.getElementById('sv-note')?.value.trim();

            if (!userId || !month || !amount) {
                toast('সকল প্রয়োজনীয় তথ্য পূরণ করুন।', '#e53e3e');
                return;
            }

            const savings = DB.getSavings();
            savings.push({
                id: DB.genID('SV'),
                userId: userId,
                month: month,
                amount: amount,
                note: note || '',
                date: new Date().toISOString()
            });

            DB.set(DB.KEYS.SAVINGS, savings);
            renderSavingsTable();
            toast('সঞ্চয় এন্ট্রি যোগ হয়েছে ✅');

            // Clear form
            document.getElementById('sv-amount').value = '';
            document.getElementById('sv-note').value = '';

        } catch (error) {
            console.error('[Dashboard] Add saving error:', error);
            toast('সঞ্চয় যোগ করতে সমস্যা', '#e53e3e');
        }
    }

    function deleteSaving(id) {
        if (!confirm('এই এন্ট্রি মুছবেন?')) return;

        try {
            DB.set(DB.KEYS.SAVINGS, DB.getSavings().filter(s => s.id !== id));
            renderSavingsTable();
            toast('মুছে দেওয়া হয়েছে।', '#e53e3e');
        } catch (error) {
            console.error('[Dashboard] Delete saving error:', error);
            toast('মুছতে সমস্যা', '#e53e3e');
        }
    }

    // ════════ ALL LOANS ════════

    function loadAllLoans() {
        if (currentUser.role !== 'admin') {
            toast('শুধুমাত্র অ্যাডমিনের অ্যাক্সেস আছে', '#e53e3e');
            return;
        }

        try {
            const loans = DB.getLoans();
            const users = DB.getUsers();
            const table = document.getElementById('all-loans-table');
            if (!table) return;

            const statusMap = {
                active: '<span class="tag tag-pend">চলমান</span>',
                paid: '<span class="tag tag-ok">পরিশোধিত</span>',
                pending: '<span class="tag tag-blue">পেন্ডিং</span>',
                rejected: '<span class="tag tag-no">বাতিল</span>'
            };

            if (!loans.length) {
                table.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#aaa;padding:20px;">কোনো করজ নেই</td></tr>';
                return;
            }

            table.innerHTML = loans.slice().reverse().map(l => {
                const user = users.find(u => u.id === l.userId);
                return `
                    <tr>
                        <td style="font-size:11px;">${l.id}</td>
                        <td>${user ? user.name : l.userName || '—'}</td>
                        <td>৳${(l.amount || 0).toLocaleString('bn')}</td>
                        <td>৳${(l.remaining || l.amount || 0).toLocaleString('bn')}</td>
                        <td>${l.reason || '—'}</td>
                        <td>${statusMap[l.status] || l.status}</td>
                        <td>
                            <select onchange="updateLoanStatus('${l.id}',this.value)" style="font-size:11px;padding:3px;border:1px solid #d1fae5;border-radius:4px;">
                                <option value="pending" ${l.status === 'pending' ? 'selected' : ''}>পেন্ডিং</option>
                                <option value="active" ${l.status === 'active' ? 'selected' : ''}>অনুমোদিত</option>
                                <option value="paid" ${l.status === 'paid' ? 'selected' : ''}>পরিশোধিত</option>
                                <option value="rejected" ${l.status === 'rejected' ? 'selected' : ''}>বাতিল</option>
                            </select>
                        </td>
                    </tr>
                `;
            }).join('');

        } catch (error) {
            console.error('[Dashboard] Load all loans error:', error);
            toast('করজ লোড করতে সমস্যা', '#e53e3e');
        }
    }

    function updateLoanStatus(id, status) {
        try {
            const loans = DB.getLoans();
            const idx = loans.findIndex(l => l.id === id);

            if (idx >= 0) {
                loans[idx].status = status;
                if (status === 'paid') loans[idx].remaining = 0;
                DB.set(DB.KEYS.LOANS, loans);
                toast('অবস্থা আপডেট হয়েছে ✅');
                loadAllLoans();
            }

        } catch (error) {
            console.error('[Dashboard] Update loan status error:', error);
            toast('অবস্থা আপডেটে সমস্যা', '#e53e3e');
        }
    }

    // ════════ LOGOUT ════════

    function doLogout() {
        try {
            DB.clearSession();
            localStorage.removeItem('bf_remember');
            window.location.href = '../index.html';
        } catch (error) {
            console.error('[Dashboard] Logout error:', error);
            window.location.href = '../index.html';
        }
    }

    // ════════ SIDEBAR ════════

    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlayBg');
        if (sidebar) sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('show');
    }

    function closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlayBg');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('show');
    }

    // ════════ EXPOSE GLOBALLY ════════

    window.showPanel = showPanel;
    window.loadOverview = loadOverview;
    window.loadSavings = loadSavings;
    window.loadLoans = loadLoans;
    window.loadOrders = loadOrders;
    window.loadProfile = loadProfile;
    window.saveProfile = saveProfile;
    window.loadAdminPanel = loadAdminPanel;
    window.renderAllUsers = renderAllUsers;
    window.loadAllSavings = loadAllSavings;
    window.loadAllLoans = loadAllLoans;
    window.addSavingEntry = addSavingEntry;
    window.deleteSaving = deleteSaving;
    window.submitLoan = submitLoan;
    window.changeUserRole = changeUserRole;
    window.updateLoanStatus = updateLoanStatus;
    window.doLogout = doLogout;
    window.toggleSidebar = toggleSidebar;
    window.closeSidebar = closeSidebar;
    window.toast = toast;

})();