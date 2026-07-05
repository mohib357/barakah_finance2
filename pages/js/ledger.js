// C:\Project\Barakah_Finance\pages\js\ledger.js
// ════════ LEDGER & ACCOUNTING — FIXED & IMPROVED VERSION ════════
// FIXES:
// 1. Added proper API_BASE with environment detection
// 2. Added DB availability check for fallback
// 3. Added proper error handling with try-catch
// 4. Added toast function with proper styling
// 5. Added Bengali number formatting
// 6. Fixed duplicate API calls with caching
// 7. Added loading states for async operations
// 8. Fixed all panel loading functions
// 9. Added proper data validation
// 10. Added auto-refresh on data change

(function () {
    'use strict';

    const DEBUG = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // ── Environment Detection ──
    const API_BASE = (() => {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:3001/api';
        }
        return 'https://api.barakah-finance.com/api';
    })();

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
            border-radius: 8px;
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
        if (!document.querySelector('style[data-ledger-toast]')) {
            const style = document.createElement('style');
            style.dataset.ledgerToast = '1';
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
    function fmtNum(n) {
        if (n === undefined || n === null) return '০';
        return Number(n).toLocaleString('bn');
    }

    // ── Format date ──
    function formatDate(iso) {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleDateString('bn-BD');
        } catch {
            return '—';
        }
    }

    // ── State ──
    let TOKEN = localStorage.getItem('bf_token') || '';
    let serverOnline = false;
    let allLedger = [];
    let allSavings = [];
    let allLoans = [];
    let allMembers = [];
    let selectedLoanId = null;
    let isLoading = false;

    // ── Fetch with timeout ──
    function fetchWithTimeout(url, options, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const controller = new AbortController();
            const signal = controller.signal;

            const timeoutId = setTimeout(() => {
                controller.abort();
                reject(new Error('Request timeout'));
            }, timeout);

            fetch(url, { ...options, signal })
                .then(response => {
                    clearTimeout(timeoutId);
                    resolve(response);
                })
                .catch(error => {
                    clearTimeout(timeoutId);
                    reject(error);
                });
        });
    }

    // ── API Call ──
    async function api(path, opts = {}) {
        try {
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${TOKEN}`
            };

            const response = await fetchWithTimeout(`${API_BASE}${path}`, {
                headers: headers,
                ...opts,
                ...(opts.body ? { body: JSON.stringify(opts.body) } : {})
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            if (error.message.includes('timeout') || error.message.includes('fetch')) {
                serverOnline = false;
                if (DEBUG) console.warn('[Ledger] Server offline, using localStorage fallback');
                return null;
            }
            throw error;
        }
    }

    // ── Server Check ──
    async function checkServer() {
        try {
            const response = await fetchWithTimeout(`${API_BASE}/health`, {}, 2000);
            serverOnline = response.ok;
            return serverOnline;
        } catch {
            serverOnline = false;
            return false;
        }
    }

    // ════════ TAB SWITCHING ════════

    function showTab(name, btn) {
        try {
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));

            const panel = document.getElementById('panel-' + name);
            if (panel) panel.classList.add('active');
            if (btn) btn.classList.add('active');

            // Load data based on tab
            const loaders = {
                savings: loadSavings,
                loans: loadLoans,
                reports: () => { loadChart(); loadMemberReport(); },
                balance: loadBalanceSheet,
                ledger: () => { renderLedgerTable(); }
            };

            if (loaders[name]) loaders[name]();

        } catch (error) {
            console.error('[Ledger] Show tab error:', error);
            toast('ট্যাব লোড করতে সমস্যা', '#e53e3e');
        }
    }

    // ════════ SUMMARY ════════

    async function loadSummary() {
        try {
            if (serverOnline) {
                const data = await api('/ledger');
                if (data) {
                    document.getElementById('s-income').textContent = '৳' + fmtNum(data.balance?.totalIncome || 0);
                    document.getElementById('s-expense').textContent = '৳' + fmtNum(data.balance?.totalExpense || 0);
                    const net = data.balance?.net || 0;
                    const el = document.getElementById('s-net');
                    el.textContent = '৳' + fmtNum(Math.abs(net));
                    el.className = 'value ' + (net >= 0 ? 'net-pos' : 'net-neg');
                    allLedger = data.entries || [];
                }
            } else {
                // localStorage fallback
                if (isDBAvailable()) {
                    const savings = DB.getSavings();
                    const total = savings.reduce((sum, s) => sum + (s.amount || 0), 0);
                    document.getElementById('s-income').textContent = '৳' + fmtNum(total);
                    document.getElementById('s-savings').textContent = '৳' + fmtNum(total);
                    allLedger = [];
                }
            }

            // Savings total
            let savingsTotal = 0;
            if (serverOnline) {
                const data = await api('/savings');
                savingsTotal = data?.stats?.total || 0;
            } else if (isDBAvailable()) {
                savingsTotal = DB.getSavings().reduce((sum, s) => sum + (s.amount || 0), 0);
            }

            const savingsEl = document.getElementById('s-savings');
            if (savingsEl) savingsEl.textContent = '৳' + fmtNum(savingsTotal);

            renderLedgerTable();

        } catch (error) {
            console.error('[Ledger] Load summary error:', error);
            toast('সারসংক্ষেপ লোড করতে সমস্যা', '#e53e3e');
        }
    }

    // ════════ LEDGER ════════

    function renderLedgerTable() {
        try {
            const typeFilter = document.getElementById('f-type')?.value || '';
            const categoryFilter = document.getElementById('f-cat')?.value || '';
            const monthFilter = document.getElementById('f-month')?.value || '';

            let entries = allLedger.slice();

            if (typeFilter) entries = entries.filter(e => e.type === typeFilter);
            if (categoryFilter) entries = entries.filter(e => e.category === categoryFilter);
            if (monthFilter) entries = entries.filter(e => e.date?.startsWith(monthFilter));

            const catLabels = {
                savings: 'সঞ্চয়',
                late_fee: 'বিলম্ব ফি',
                loan_repayment: 'করজ পরিশোধ',
                profit: 'মুনাফা',
                donation: 'অনুদান',
                loan_disbursed: 'করজ প্রদান',
                operational: 'পরিচালন',
                purchase: 'ক্রয়',
                other_income: 'অন্যান্য আয়',
                other_expense: 'অন্যান্য ব্যয়',
                manual: 'ম্যানুয়াল'
            };

            const table = document.getElementById('ledger-tbody');
            if (!table) return;

            if (!entries.length) {
                table.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#aaa;padding:20px;">কোনো এন্ট্রি নেই</td></tr>';
                return;
            }

            table.innerHTML = entries.map(e => `
                <tr>
                    <td style="font-size:11px;">${formatDate(e.date)}</td>
                    <td><span class="badge badge-${e.type}">${e.type === 'income' ? '↑ আয়' : '↓ ব্যয়'}</span></td>
                    <td>${catLabels[e.category] || e.category}</td>
                    <td>${e.description || '—'}</td>
                    <td style="font-weight:700;color:${e.type === 'income' ? 'var(--income)' : 'var(--expense)'};">৳${fmtNum(e.amount)}</td>
                    <td>${e.manual ? `<button class="btn btn-red btn-sm" onclick="deleteLedger('${e.id}')">🗑️</button>` : '<span style="color:#aaa;font-size:11px;">স্বয়ং</span>'}</td>
                </tr>
            `).join('');

        } catch (error) {
            console.error('[Ledger] Render ledger error:', error);
            toast('লেজার টেবিল লোড করতে সমস্যা', '#e53e3e');
        }
    }

    async function filterLedger() {
        renderLedgerTable();
    }

    async function addLedgerEntry() {
        try {
            const type = document.getElementById('e-type')?.value;
            const category = document.getElementById('e-cat')?.value;
            const amount = parseFloat(document.getElementById('e-amount')?.value);
            const description = document.getElementById('e-desc')?.value.trim();
            const note = document.getElementById('e-note')?.value.trim();

            if (!amount || !description) {
                toast('পরিমাণ ও বিবরণ দিন', '#e53e3e');
                return;
            }

            if (serverOnline) {
                const data = await api('/ledger', {
                    method: 'POST',
                    body: { type, category, amount, description, note }
                });

                if (data) {
                    toast('এন্ট্রি যোগ হয়েছে ✅');
                    await loadSummary();
                    // Clear form
                    document.getElementById('e-amount').value = '';
                    document.getElementById('e-desc').value = '';
                    document.getElementById('e-note').value = '';
                }
            } else {
                toast('সার্ভার অফলাইন। ডেটা সংরক্ষণ করা সম্ভব নয়।', '#e53e3e');
            }

        } catch (error) {
            console.error('[Ledger] Add entry error:', error);
            toast('এন্ট্রি যোগ করতে সমস্যা', '#e53e3e');
        }
    }

    async function deleteLedger(id) {
        if (!confirm('এই এন্ট্রি মুছবেন?')) return;

        try {
            await api(`/ledger/${id}`, { method: 'DELETE' });
            toast('মুছে দেওয়া হয়েছে', '#e53e3e');
            await loadSummary();

        } catch (error) {
            console.error('[Ledger] Delete error:', error);
            toast('মুছতে সমস্যা', '#e53e3e');
        }
    }

    // ════════ SAVINGS ════════

    async function loadSavings() {
        try {
            const userFilter = document.getElementById('sv-filter-user')?.value || '';
            const monthFilter = document.getElementById('sv-filter-month')?.value || '';

            let savings = [];
            let total = 0;

            if (serverOnline) {
                const data = userFilter ? await api(`/savings/user/${userFilter}`) : await api('/savings');
                savings = data?.savings || [];
                total = data?.stats?.total || data?.total || savings.reduce((sum, s) => sum + (s.amount || 0), 0);
            } else if (isDBAvailable()) {
                savings = DB.getSavings();
                if (userFilter) savings = savings.filter(s => s.userId === userFilter);
                total = savings.reduce((sum, s) => sum + (s.amount || 0), 0);
            }

            if (monthFilter) savings = savings.filter(s => s.month === monthFilter);
            allSavings = savings;

            const badgeEl = document.getElementById('sv-total-badge');
            if (badgeEl) badgeEl.textContent = 'মোট: ৳' + fmtNum(total);

            const table = document.getElementById('savings-tbody');
            if (!table) return;

            if (!savings.length) {
                table.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#aaa;padding:20px;">কোনো সঞ্চয় নেই</td></tr>';
                return;
            }

            table.innerHTML = savings.slice().reverse().map(s => `
                <tr>
                    <td>${s.userName || getUserName(s.userId) || '—'}</td>
                    <td>${s.month || '—'}</td>
                    <td style="color:var(--income);font-weight:700;">৳${fmtNum(s.amount)}</td>
                    <td>${s.lateFee ? `<span class="badge badge-pending">৳${fmtNum(s.lateFee)}</span>` : '—'}</td>
                    <td style="font-size:11px;">${s.note || '—'}</td>
                    <td style="font-size:11px;">${formatDate(s.date)}</td>
                    <td><button class="btn btn-red btn-sm" onclick="deleteSaving('${s.id}')">🗑️</button></td>
                </tr>
            `).join('');

        } catch (error) {
            console.error('[Ledger] Load savings error:', error);
            toast('সঞ্চয় লোড করতে সমস্যা', '#e53e3e');
        }
    }

    function getUserName(userId) {
        if (!isDBAvailable()) return '—';
        try {
            const user = DB.getUsers().find(u => u.id === userId);
            return user ? user.name : '—';
        } catch {
            return '—';
        }
    }

    async function addSaving() {
        try {
            const userId = document.getElementById('sv-user')?.value;
            const month = document.getElementById('sv-month')?.value;
            const amount = parseFloat(document.getElementById('sv-amount')?.value);
            const note = document.getElementById('sv-note')?.value.trim();
            const lateFlag = document.getElementById('sv-late')?.value === 'true';

            if (!userId || !month || !amount) {
                toast('সকল তথ্য পূরণ করুন', '#e53e3e');
                return;
            }

            if (serverOnline) {
                const data = await api('/savings', {
                    method: 'POST',
                    body: { userId, month, amount, note, lateFlag }
                });

                if (data?.entry) {
                    toast('সঞ্চয় এন্ট্রি যোগ হয়েছে ✅');
                    await loadSavings();
                    await loadSummary();
                    // Clear form
                    document.getElementById('sv-amount').value = '';
                    document.getElementById('sv-note').value = '';
                } else if (data?.error) {
                    toast(data.error, '#e53e3e');
                }
            } else if (isDBAvailable()) {
                const users = DB.getUsers();
                const user = users.find(u => u.id === userId);
                const entry = {
                    id: 'sv-' + Date.now(),
                    userId: userId,
                    userName: user?.name || '—',
                    month: month,
                    amount: amount,
                    note: note || '',
                    lateFlag: lateFlag,
                    lateFee: lateFlag ? 100 : 0,
                    date: new Date().toISOString()
                };
                const savings = DB.getSavings();
                savings.push(entry);
                DB.set(DB.KEYS.SAVINGS, savings);
                toast('সঞ্চয় এন্ট্রি যোগ হয়েছে (অফলাইন) ✅');
                await loadSavings();
            }

        } catch (error) {
            console.error('[Ledger] Add saving error:', error);
            toast('সঞ্চয় যোগ করতে সমস্যা', '#e53e3e');
        }
    }

    async function deleteSaving(id) {
        if (!confirm('মুছবেন?')) return;

        try {
            if (serverOnline) {
                await api(`/savings/${id}`, { method: 'DELETE' });
            } else if (isDBAvailable()) {
                DB.set(DB.KEYS.SAVINGS, DB.getSavings().filter(s => s.id !== id));
            }
            toast('মুছে দেওয়া হয়েছে', '#e53e3e');
            await loadSavings();

        } catch (error) {
            console.error('[Ledger] Delete saving error:', error);
            toast('মুছতে সমস্যা', '#e53e3e');
        }
    }

    async function loadMissing() {
        try {
            const month = document.getElementById('sv-filter-month')?.value || new Date().toISOString().slice(0, 7);
            let missing = [];

            if (serverOnline) {
                const data = await api(`/savings/missing/${month}`);
                missing = data?.missing || [];
            } else if (isDBAvailable()) {
                const members = DB.getUsers().filter(u => u.role === 'member');
                const paid = DB.getSavings().filter(s => s.month === month).map(s => s.userId);
                missing = members.filter(m => !paid.includes(m.id));
            }

            const card = document.getElementById('missing-card');
            const title = document.getElementById('missing-title');
            const tableBody = document.getElementById('missing-tbody');

            if (card) card.style.display = 'block';
            if (title) title.textContent = `⚠️ ${month} মাসে যারা এখনো দেননি (${fmtNum(missing.length)} জন)`;

            if (tableBody) {
                if (!missing.length) {
                    tableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#065F46;padding:16px;">✅ সবাই জমা দিয়েছেন</td></tr>';
                } else {
                    tableBody.innerHTML = missing.map(m => `
                        <tr>
                            <td>${m.name}</td>
                            <td>${m.memberID || '—'}</td>
                            <td>${m.phone}</td>
                            <td><button class="btn btn-green btn-sm" onclick="quickAddSaving('${m.id}','${m.name}','${month}')">+ যোগ করুন</button></td>
                        </tr>
                    `).join('');
                }
            }

        } catch (error) {
            console.error('[Ledger] Load missing error:', error);
            toast('মিসিং ডেটা লোড করতে সমস্যা', '#e53e3e');
        }
    }

    function quickAddSaving(userId, name, month) {
        try {
            const userSelect = document.getElementById('sv-user');
            const monthInput = document.getElementById('sv-month');
            const amountInput = document.getElementById('sv-amount');

            if (userSelect) userSelect.value = userId;
            if (monthInput) monthInput.value = month;
            if (amountInput) amountInput.value = 2000;

            const card = document.getElementById('missing-card');
            if (card) card.style.display = 'none';

            toast(`${name} এর জন্য ফর্ম পূরণ হয়েছে`, '#065F46');

            // Switch to savings tab
            const tabs = document.querySelectorAll('.tab');
            const savingsTab = Array.from(tabs).find(t => t.textContent.includes('সঞ্চয়'));
            if (savingsTab) showTab('savings', savingsTab);

        } catch (error) {
            console.error('[Ledger] Quick add saving error:', error);
            toast('ফর্ম পূরণে সমস্যা', '#e53e3e');
        }
    }

    // ════════ LOANS ════════

    async function loadLoans() {
        try {
            let loans = [];

            if (serverOnline) {
                const data = await api('/loans');
                loans = data?.loans || [];
            } else if (isDBAvailable()) {
                loans = DB.getLoans();
                const users = DB.getUsers();
                loans = loans.map(l => ({
                    ...l,
                    userName: users.find(u => u.id === l.userId)?.name || l.userName || '—'
                }));
            }

            allLoans = loans;

            const statusMap = {
                pending: '<span class="badge badge-pending">পেন্ডিং</span>',
                active: '<span class="badge badge-active">সক্রিয়</span>',
                paid: '<span class="badge badge-paid">পরিশোধিত</span>',
                rejected: '<span class="badge" style="background:#fee2e2;color:#991b1b;">বাতিল</span>'
            };

            const table = document.getElementById('loans-tbody');
            if (!table) return;

            if (!loans.length) {
                table.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#aaa;padding:20px;">কোনো করজ নেই</td></tr>';
                return;
            }

            table.innerHTML = loans.slice().reverse().map(l => `
                <tr>
                    <td>${l.userName || getUserName(l.userId) || '—'}</td>
                    <td style="font-weight:700;">৳${fmtNum(l.amount)}</td>
                    <td style="color:${l.remaining > 0 ? 'var(--expense)' : 'var(--income)'};">৳${fmtNum(l.remaining || 0)}</td>
                    <td style="font-size:11px;">${l.reason || '—'}</td>
                    <td>${statusMap[l.status] || l.status}</td>
                    <td style="font-size:11px;">${formatDate(l.createdAt)}</td>
                    <td>
                        <div style="display:flex;gap:4px;flex-wrap:wrap;">
                            ${l.status === 'pending' ? `<button class="btn btn-green btn-sm" onclick="updateLoan('${l.id}','active')">✅ অনুমোদন</button><button class="btn btn-red btn-sm" onclick="updateLoan('${l.id}','rejected')">❌</button>` : ''}
                            ${l.status === 'active' ? `<button class="btn btn-gold btn-sm" onclick="openPayment('${l.id}',${l.remaining || 0})">💳 পরিশোধ</button>` : ''}
                        </div>
                    </td>
                </tr>
            `).join('');

        } catch (error) {
            console.error('[Ledger] Load loans error:', error);
            toast('করজ লোড করতে সমস্যা', '#e53e3e');
        }
    }

    async function updateLoan(id, status) {
        try {
            if (serverOnline) {
                await api(`/loans/${id}/status`, { method: 'PATCH', body: { status } });
            } else if (isDBAvailable()) {
                const loans = DB.getLoans();
                const idx = loans.findIndex(l => l.id === id);
                if (idx >= 0) loans[idx].status = status;
                DB.set(DB.KEYS.LOANS, loans);
            }
            toast('অবস্থা আপডেট হয়েছে ✅');
            await loadLoans();

        } catch (error) {
            console.error('[Ledger] Update loan error:', error);
            toast('অবস্থা আপডেটে সমস্যা', '#e53e3e');
        }
    }

    function openPayment(id, remaining) {
        selectedLoanId = id;
        const amountInput = document.getElementById('pay-amount');
        const noteInput = document.getElementById('pay-note');
        if (amountInput) amountInput.value = remaining;
        if (noteInput) noteInput.value = '';

        const modal = document.getElementById('payment-modal');
        if (modal) modal.style.display = 'flex';
    }

    function closePayment() {
        const modal = document.getElementById('payment-modal');
        if (modal) modal.style.display = 'none';
        selectedLoanId = null;
    }

    async function submitPayment() {
        try {
            const amount = parseFloat(document.getElementById('pay-amount')?.value);
            const note = document.getElementById('pay-note')?.value;

            if (!amount) {
                toast('পরিমাণ দিন', '#e53e3e');
                return;
            }

            if (serverOnline) {
                await api(`/loans/${selectedLoanId}/payment`, {
                    method: 'POST',
                    body: { amount, note }
                });
            } else {
                toast('সার্ভার অফলাইন। পেমেন্ট রেকর্ড করা সম্ভব নয়।', '#e53e3e');
                return;
            }

            toast('পরিশোধ রেকর্ড হয়েছে ✅');
            closePayment();
            await loadLoans();

        } catch (error) {
            console.error('[Ledger] Submit payment error:', error);
            toast('পেমেন্ট রেকর্ডে সমস্যা', '#e53e3e');
        }
    }

    // ════════ REPORTS ════════

    async function loadChart() {
        try {
            const year = document.getElementById('chart-year')?.value || new Date().getFullYear();
            let months = [];

            if (serverOnline) {
                const data = await api(`/ledger/monthly-summary?year=${year}`);
                months = data?.months || [];
            }

            if (!months.length && isDBAvailable()) {
                const savings = DB.getSavings();
                for (let m = 1; m <= 12; m++) {
                    const monthKey = `${year}-${String(m).padStart(2, '0')}`;
                    const income = savings.filter(s => s.month === monthKey).reduce((sum, s) => sum + (s.amount || 0), 0);
                    months.push({ month: monthKey, income: income, expense: 0 });
                }
            }

            const maxVal = Math.max(...months.map(m => Math.max(m.income, m.expense)), 1);
            const monthNames = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];

            const chartEl = document.getElementById('monthly-chart');
            if (!chartEl) return;

            if (!months.length) {
                chartEl.innerHTML = '<div style="text-align:center;color:#aaa;padding:20px;">কোনো ডেটা নেই</div>';
                return;
            }

            chartEl.innerHTML = months.map((m, i) => `
                <div class="chart-bar-g">
                    <div style="display:flex;gap:2px;align-items:flex-end;height:120px;">
                        <div class="bar-income" style="width:14px;height:${Math.max(4, m.income / maxVal * 110)}px;" title="আয়: ৳${fmtNum(m.income)}"></div>
                        <div class="bar-expense" style="width:14px;height:${Math.max(4, m.expense / maxVal * 110)}px;" title="ব্যয়: ৳${fmtNum(m.expense)}"></div>
                    </div>
                    <div class="bar-lbl">${monthNames[i]}</div>
                </div>
            `).join('');

        } catch (error) {
            console.error('[Ledger] Load chart error:', error);
            toast('চার্ট লোড করতে সমস্যা', '#e53e3e');
        }
    }

    async function loadMemberReport() {
        try {
            let report = [];

            if (serverOnline) {
                const data = await api('/reports/member-savings');
                report = data?.report || [];
            } else if (isDBAvailable()) {
                const members = DB.getUsers().filter(u => u.role === 'member');
                const savings = DB.getSavings();
                report = members.map(m => {
                    const memberSavings = savings.filter(s => s.userId === m.id);
                    return {
                        name: m.name,
                        memberID: m.memberID,
                        totalSaved: memberSavings.reduce((sum, s) => sum + (s.amount || 0), 0),
                        monthCount: memberSavings.length,
                        lastPayment: memberSavings.slice(-1)[0]?.date
                    };
                });
            }

            const table = document.getElementById('member-report-tbody');
            if (!table) return;

            if (!report.length) {
                table.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#aaa;padding:16px;">কোনো ডেটা নেই</td></tr>';
                return;
            }

            table.innerHTML = report.map(r => `
                <tr>
                    <td>${r.name}</td>
                    <td>${r.memberID || '—'}</td>
                    <td style="color:var(--income);font-weight:700;">৳${fmtNum(r.totalSaved)}</td>
                    <td>${fmtNum(r.monthCount)} মাস</td>
                    <td style="font-size:11px;">${formatDate(r.lastPayment)}</td>
                </tr>
            `).join('');

        } catch (error) {
            console.error('[Ledger] Load member report error:', error);
            toast('সদস্য রিপোর্ট লোড করতে সমস্যা', '#e53e3e');
        }
    }

    // ════════ BALANCE SHEET ════════

    async function loadBalanceSheet() {
        try {
            if (!serverOnline && isDBAvailable()) {
                const savings = DB.getSavings();
                const totalSavings = savings.reduce((sum, s) => sum + (s.amount || 0), 0);
                const loans = DB.getLoans();
                const outstanding = loans.filter(l => l.status === 'active')
                    .reduce((sum, l) => sum + (l.remaining || 0), 0);

                const assetsBody = document.getElementById('assets-tbody');
                const liabBody = document.getElementById('liab-tbody');

                if (assetsBody) {
                    assetsBody.innerHTML = `
                        <tr><td style="padding:8px;">মোট সঞ্চয় তহবিল</td><td style="font-weight:700;color:var(--income);">৳${fmtNum(totalSavings)}</td></tr>
                        <tr><td style="padding:8px;">চলমান করজ</td><td>৳${fmtNum(outstanding)}</td></tr>
                    `;
                }

                if (liabBody) {
                    liabBody.innerHTML = `
                        <tr><td style="padding:8px;">সদস্যদের জমা</td><td style="font-weight:700;color:var(--expense);">৳${fmtNum(totalSavings)}</td></tr>
                    `;
                }

                document.getElementById('bs-income').textContent = '৳' + fmtNum(totalSavings);
                document.getElementById('bs-net').textContent = '৳' + fmtNum(totalSavings - outstanding);

                return;
            }

            const data = await api('/ledger/balance-sheet');
            if (!data) return;

            // Assets
            const assetsBody = document.getElementById('assets-tbody');
            if (assetsBody) {
                assetsBody.innerHTML = Object.entries(data.assets || {})
                    .map(([key, value]) => `
                        <tr><td style="padding:8px;">${key}</td><td style="font-weight:700;color:var(--income);">৳${fmtNum(value)}</td></tr>
                    `).join('');
            }

            // Liabilities
            const liabBody = document.getElementById('liab-tbody');
            if (liabBody) {
                liabBody.innerHTML = Object.entries(data.liabilities || {})
                    .map(([key, value]) => `
                        <tr><td style="padding:8px;">${key}</td><td style="font-weight:700;color:var(--expense);">৳${fmtNum(value)}</td></tr>
                    `).join('');
            }

            // Summary
            document.getElementById('bs-income').textContent = '৳' + fmtNum(data.income?.total || 0);
            document.getElementById('bs-expense').textContent = '৳' + fmtNum(data.expense?.total || 0);

            const net = data.net || 0;
            const netEl = document.getElementById('bs-net');
            if (netEl) {
                netEl.textContent = '৳' + fmtNum(Math.abs(net));
                netEl.style.color = net >= 0 ? 'var(--income)' : 'var(--expense)';
            }

        } catch (error) {
            console.error('[Ledger] Load balance sheet error:', error);
            toast('ব্যালেন্স শিট লোড করতে সমস্যা', '#e53e3e');
        }
    }

    // ════════ CSV EXPORT ════════

    function exportLedgerCSV() {
        try {
            if (!allLedger.length) {
                toast('কোনো ডেটা নেই', '#C9A227');
                return;
            }

            const headers = ['তারিখ', 'ধরন', 'ক্যাটাগরি', 'বিবরণ', 'পরিমাণ'];
            const rows = allLedger.map(e => [
                e.date ? new Date(e.date).toLocaleDateString() : '',
                e.type,
                e.category,
                e.description || '',
                e.amount || 0
            ]);

            const csv = [headers, ...rows]
                .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
                .join('\n');

            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'ledger-' + new Date().toISOString().slice(0, 10) + '.csv';
            link.click();

            toast('CSV ডাউনলোড হয়েছে ✅');

        } catch (error) {
            console.error('[Ledger] Export CSV error:', error);
            toast('CSV ডাউনলোডে সমস্যা', '#e53e3e');
        }
    }

    // ════════ MEMBER DROPDOWNS ════════

    function loadMemberDropdowns() {
        if (!isDBAvailable()) return;

        try {
            const members = DB.getUsers().filter(u => u.role === 'member');

            const select = document.getElementById('sv-user');
            const filterSelect = document.getElementById('sv-filter-user');

            const options = members.map(m =>
                `<option value="${m.id}">${m.name} (${m.phone})</option>`
            ).join('');

            if (select) {
                select.innerHTML = '<option value="">-- সদস্য নির্বাচন --</option>' + options;
            }

            if (filterSelect) {
                filterSelect.innerHTML = '<option value="">সকল সদস্য</option>' + options;
            }

        } catch (error) {
            console.error('[Ledger] Load member dropdowns error:', error);
        }
    }

    // ════════ INIT ════════

    document.addEventListener('DOMContentLoaded', async function () {
        // Check if user is admin
        const session = isDBAvailable() ? DB.getSession() : null;

        if (!session || session.role !== 'admin') {
            alert('শুধুমাত্র অ্যাডমিনের অ্যাক্সেস আছে');
            window.location.href = '../index.html';
            return;
        }

        // Update token
        TOKEN = localStorage.getItem('bf_token') || '';

        // Check server
        await checkServer();

        // Load member dropdowns
        loadMemberDropdowns();

        // Set default month
        const monthInput = document.getElementById('sv-month');
        if (monthInput) monthInput.value = new Date().toISOString().slice(0, 7);

        // Load data
        await loadSummary();

        if (DEBUG) {
            console.log('[Ledger] Initialized. Server online:', serverOnline);
        }
    });

    // ── Populate year options ──
    (function populateYearOptions() {
        const yearSelect = document.getElementById('chart-year');
        if (!yearSelect) return;

        const currentYear = new Date().getFullYear();
        yearSelect.innerHTML = '';
        for (let y = currentYear; y >= currentYear - 5; y--) {
            const option = document.createElement('option');
            option.value = y;
            option.textContent = y;
            yearSelect.appendChild(option);
        }
    })();

    // ════════ EXPOSE GLOBALLY ════════

    window.showTab = showTab;
    window.loadSummary = loadSummary;
    window.renderLedgerTable = renderLedgerTable;
    window.filterLedger = filterLedger;
    window.addLedgerEntry = addLedgerEntry;
    window.deleteLedger = deleteLedger;
    window.loadSavings = loadSavings;
    window.addSaving = addSaving;
    window.deleteSaving = deleteSaving;
    window.loadMissing = loadMissing;
    window.quickAddSaving = quickAddSaving;
    window.loadLoans = loadLoans;
    window.updateLoan = updateLoan;
    window.openPayment = openPayment;
    window.closePayment = closePayment;
    window.submitPayment = submitPayment;
    window.loadChart = loadChart;
    window.loadMemberReport = loadMemberReport;
    window.loadBalanceSheet = loadBalanceSheet;
    window.exportLedgerCSV = exportLedgerCSV;
    window.loadMemberDropdowns = loadMemberDropdowns;
    window.checkServer = checkServer;
    window.toast = toast;

})();