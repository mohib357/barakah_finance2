// C:\Project\barakah_finance2\admin\js\admin.js

(function () {
    'use strict';

    // ── Constants ──
    const API_BASE = window.location.hostname === 'localhost'
        ? 'http://localhost:3001/api'
        : '/api';

    const DEBUG = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // ── State ──
    let currentAdmin = null;
    let currentFilter = 'all';
    let selectedAppID = null;
    let currentPage = 1;
    let totalPages = 1;
    let applications = [];

    // ── Role Labels ──
    const ROLE_LABELS = {
        committee1: 'আহ্বায়ক কমিটি (০১)',
        committee2: 'আহ্বায়ক কমিটি (০২)',
        committee3: 'আহ্বায়ক কমিটি (০৩)',
        committee4: 'আহ্বায়ক কমিটি (০৪)',
        secretary: 'সাধারণ সম্পাদক',
        vicePresident: 'সহ-সভাপতি',
        president: 'সভাপতি'
    };

    // ── Approval Order ──
    const APPROVAL_ORDER = ['committee1', 'committee2', 'committee3', 'committee4', 'secretary', 'vicePresident', 'president'];

    // ── Helper: API Call ──
    async function apiFetch(path, options = {}) {
        const token = localStorage.getItem('bf_admin_token');
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers
        };

        try {
            const response = await fetch(`${API_BASE}${path}`, {
                ...options,
                headers
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                if (response.status === 401) {
                    // Token expired, logout
                    adminLogout();
                    showToast('সেশন মেয়াদ শেষ। দয়া করে আবার লগইন করুন।', '#e53e3e');
                    throw new Error('SESSION_EXPIRED');
                }
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            if (error.message !== 'SESSION_EXPIRED') {
                console.error('[Admin] API error:', error);
            }
            throw error;
        }
    }

    // ── Toast ──
    function showToast(msg, color = '#065F46') {
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
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            animation: slideUp 0.3s ease;
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

    // ── Ensure animation ──
    (function ensureToastAnimation() {
        if (!document.querySelector('style[data-admin-toast]')) {
            const style = document.createElement('style');
            style.dataset.adminToast = '1';
            style.textContent = `
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(15px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }
    })();

    // ── LOGIN ──
    function showLoginModal() {
        document.getElementById('loginModal').classList.remove('hidden');
        document.getElementById('loginPass').value = '';
    }

    async function doLogin() {
        const role = document.getElementById('loginRole').value;
        const password = document.getElementById('loginPass').value;

        if (!role) {
            showToast('ভূমিকা নির্বাচন করুন', '#e53e3e');
            return;
        }

        if (!password) {
            showToast('পাসওয়ার্ড দিন', '#e53e3e');
            return;
        }

        try {
            const result = await apiFetch('/auth/admin-login', {
                method: 'POST',
                body: JSON.stringify({ role, password })
            });

            if (result.token) {
                localStorage.setItem('bf_admin_token', result.token);
                localStorage.setItem('bf_admin_role', role);
                currentAdmin = role;

                document.getElementById('adminBadge').classList.remove('hidden');
                document.getElementById('adminRoleLabel').textContent = ROLE_LABELS[role];
                document.getElementById('loginBtn').classList.add('hidden');
                document.getElementById('logoutBtn').classList.remove('hidden');
                document.getElementById('loginModal').classList.add('hidden');
                document.getElementById('loginPass').value = '';

                showToast('স্বাগতম! ' + ROLE_LABELS[role], '#065F46');
                renderTable();
            } else {
                showToast(result.error || 'লগইন ব্যর্থ', '#e53e3e');
            }

        } catch (error) {
            console.error('[Admin] Login error:', error);
            showToast('লগইন করতে সমস্যা', '#e53e3e');
        }
    }

    function adminLogout() {
        localStorage.removeItem('bf_admin_token');
        localStorage.removeItem('bf_admin_role');
        currentAdmin = null;
        document.getElementById('adminBadge').classList.add('hidden');
        document.getElementById('loginBtn').classList.remove('hidden');
        document.getElementById('logoutBtn').classList.add('hidden');
        renderTable();
        showToast('লগআউট হয়েছে', '#065F46');
    }

    // ── Check session on load ──
    function checkSession() {
        const token = localStorage.getItem('bf_admin_token');
        const role = localStorage.getItem('bf_admin_role');

        if (token && role) {
            currentAdmin = role;
            document.getElementById('adminBadge').classList.remove('hidden');
            document.getElementById('adminRoleLabel').textContent = ROLE_LABELS[role];
            document.getElementById('loginBtn').classList.add('hidden');
            document.getElementById('logoutBtn').classList.remove('hidden');
            renderTable();
        }
    }

    // ── DATA ──
    async function getApps() {
        try {
            const result = await apiFetch(`/applications?page=${currentPage}&limit=20&status=${currentFilter}`);
            applications = result.data || [];
            totalPages = result.pagination?.totalPages || 1;
            return applications;
        } catch (error) {
            if (error.message !== 'SESSION_EXPIRED') {
                showToast('আবেদন লোড করতে সমস্যা', '#e53e3e');
            }
            return [];
        }
    }

    async function updateApp(id, data) {
        try {
            return await apiFetch(`/applications/${id}`, {
                method: 'PATCH',
                body: JSON.stringify(data)
            });
        } catch (error) {
            showToast('আপডেট করতে সমস্যা', '#e53e3e');
            throw error;
        }
    }

    async function approveStep(id, role) {
        try {
            return await apiFetch(`/applications/${id}/approve`, {
                method: 'POST',
                body: JSON.stringify({ role })
            });
        } catch (error) {
            showToast('অনুমোদন দিতে সমস্যা', '#e53e3e');
            throw error;
        }
    }

    // ── FILTER ──
    function setFilter(filter, btn) {
        currentFilter = filter;
        currentPage = 1;
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        renderTable();
    }

    // ── STATS ──
    function updateStats() {
        const apps = applications;
        document.getElementById('statTotal').textContent = apps.length;
        document.getElementById('statPending').textContent = apps.filter(a => a.status === 'pending').length;
        document.getElementById('statApproved').textContent = apps.filter(a => a.status === 'approved').length;
        document.getElementById('statRejected').textContent = apps.filter(a => a.status === 'rejected').length;
    }

    // ── RENDER TABLE ──
    async function renderTable() {
        try {
            await getApps();

            let filtered = applications;
            const search = document.getElementById('searchBox').value.toLowerCase();

            if (search) {
                filtered = filtered.filter(a =>
                    (a.applicantNameBn || '').toLowerCase().includes(search) ||
                    (a.applicantNameEn || '').toLowerCase().includes(search) ||
                    (a.nidNumber || '').includes(search) ||
                    (a.id || '').toLowerCase().includes(search) ||
                    (a.memberID || '').toLowerCase().includes(search)
                );
            }

            updateStats();

            const tbody = document.getElementById('appTableBody');
            if (!filtered.length) {
                tbody.innerHTML = `<tr><td colspan="8" class="text-center text-gray-500 py-8">কোনো আবেদন পাওয়া যায়নি</td></tr>`;
                return;
            }

            tbody.innerHTML = filtered.map(a => {
                const statusBadge = {
                    pending: '<span class="badge-pending px-2 py-0.5 rounded text-xs font-bold">পেন্ডিং</span>',
                    approved: '<span class="badge-approved px-2 py-0.5 rounded text-xs font-bold">অনুমোদিত</span>',
                    rejected: '<span class="badge-rejected px-2 py-0.5 rounded text-xs font-bold">প্রত্যাখ্যাত</span>'
                }[a.status] || '';

                const approvals = a.approvals || {};
                const committeeCount = (approvals.committee || []).length;
                const approvalSummary = `<span class="text-xs text-gray-400">
                    কমিটি: ${committeeCount}/4 | 
                    ${approvals.secretary ? '✅' : '⬜'} সম্পাদক | 
                    ${approvals.vicePresident ? '✅' : '⬜'} সহসভাপতি | 
                    ${approvals.president ? '✅' : '⬜'} সভাপতি
                </span>`;

                const date = a.submittedAt ? new Date(a.submittedAt).toLocaleDateString('bn-BD') : '—';

                // Check if current admin can approve
                let canApprove = false;
                if (currentAdmin) {
                    if (currentAdmin.startsWith('committee') && !committee.includes(currentAdmin)) canApprove = true;
                    if (currentAdmin === 'secretary' && committee.length >= 4 && !approvals.secretary) canApprove = true;
                    if (currentAdmin === 'vicePresident' && approvals.secretary && !approvals.vicePresident) canApprove = true;
                    if (currentAdmin === 'president' && approvals.vicePresident && !approvals.president) canApprove = true;
                }

                return `
                    <tr>
                        <td class="font-mono text-xs">${a.memberID || a.id.slice(0, 12)}</td>
                        <td class="font-semibold">${a.applicantNameBn || '—'}</td>
                        <td class="font-mono text-xs">${a.nidNumber || '—'}</td>
                        <td class="text-xs">${(a.phones || [])[0] || '—'}</td>
                        <td class="text-xs">${date}</td>
                        <td>${statusBadge}</td>
                        <td>${approvalSummary}</td>
                        <td>
                            <div class="flex gap-1 flex-wrap">
                                <button onclick="openDetail('${a.id}')" class="btn-primary text-xs py-1 px-2">বিস্তারিত</button>
                                ${a.status === 'pending' && canApprove ? `<button onclick="doApproveStep()" class="btn-gold text-xs py-1 px-2">অনুমোদন</button>` : ''}
                                ${a.status === 'pending' && currentAdmin === 'president' ? `<button onclick="openMemberIDModal('${a.id}')" class="btn-gold text-xs py-1 px-2">ID দিন</button>` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');

            // Pagination
            renderPagination();

        } catch (error) {
            console.error('[Admin] Render table error:', error);
        }
    }

    function renderPagination() {
        const container = document.getElementById('paginationControls');
        if (!container) return;

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = `<div class="flex gap-2 justify-center mt-4">`;
        for (let i = 1; i <= totalPages; i++) {
            html += `<button onclick="goToPage(${i})" class="px-3 py-1 rounded ${i === currentPage ? 'bg-emerald-700 text-white' : 'bg-emerald-900/30 text-emerald-300'}">${i}</button>`;
        }
        html += `</div>`;
        container.innerHTML = html;
    }

    function goToPage(page) {
        currentPage = page;
        renderTable();
    }

    // ── DETAIL MODAL ──
    function openDetail(id) {
        selectedAppID = id;
        const app = applications.find(a => a.id === id);
        if (!app) {
            showToast('আবেদন পাওয়া যায়নি', '#e53e3e');
            return;
        }

        const approvals = app.approvals || {};
        const committee = approvals.committee || [];

        // Determine if current admin can approve
        let canApprove = false;
        if (currentAdmin) {
            if (currentAdmin.startsWith('committee') && !committee.includes(currentAdmin)) canApprove = true;
            if (currentAdmin === 'secretary' && committee.length >= 4 && !approvals.secretary) canApprove = true;
            if (currentAdmin === 'vicePresident' && approvals.secretary && !approvals.vicePresident) canApprove = true;
            if (currentAdmin === 'president' && approvals.vicePresident && !approvals.president) canApprove = true;
        }

        document.getElementById('approveStepBtn').style.display = canApprove ? '' : 'none';

        const fmt = v => v || '—';
        const dateStr = app.submittedAt ? new Date(app.submittedAt).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

        document.getElementById('detailContent').innerHTML = `
            <div class="flex flex-wrap gap-4 mb-4 pb-4 border-b border-emerald-900">
                ${app.photoData ? `<img src="${app.photoData}" style="width:70px;height:84px;object-fit:cover;border:2px solid #C9A227;border-radius:4px;" />` : ''}
                <div class="flex-1">
                    <p class="font-bold text-emerald-300 text-lg">${fmt(app.applicantNameBn)}</p>
                    <p class="text-sm text-gray-300">${fmt(app.applicantNameEn)}</p>
                    <p class="text-xs text-gray-400 mt-1">NID: ${fmt(app.nidNumber)} | DOB: ${fmt(app.dob)}</p>
                    <p class="text-xs text-gray-400">জমার তারিখ: ${dateStr}</p>
                    ${app.memberID ? `<p class="text-emerald-400 font-bold text-sm mt-1">সদস্য ID: ${app.memberID}</p>` : ''}
                </div>
            </div>

            <div class="grid grid-cols-2 gap-2 text-xs mb-4">
                <div><span class="text-emerald-500">পিতা (বাং):</span> ${fmt(app.fatherNameBn)}</div>
                <div><span class="text-emerald-500">Father (Eng):</span> ${fmt(app.fatherNameEn)}</div>
                <div><span class="text-emerald-500">মাতা (বাং):</span> ${fmt(app.motherNameBn)}</div>
                <div><span class="text-emerald-500">Mother (Eng):</span> ${fmt(app.motherNameEn)}</div>
                <div><span class="text-emerald-500">পেশা:</span> ${fmt(app.occupation)}</div>
                <div><span class="text-emerald-500">আয়ের উৎস:</span> ${fmt(app.incomeSource)}</div>
                <div class="col-span-2"><span class="text-emerald-500">বর্তমান ঠিকানা:</span> ${fmt(app.currentAddress)}</div>
                <div class="col-span-2"><span class="text-emerald-500">স্থায়ী ঠিকানা:</span> ${fmt(app.permanentAddress)}</div>
                <div class="col-span-2"><span class="text-emerald-500">মোবাইল:</span> ${(app.phones || []).join(' | ')}</div>
            </div>

            <div class="bg-black/20 rounded-lg p-3 text-xs mb-4">
                <p class="text-emerald-400 font-bold mb-2">নমিনির তথ্য</p>
                <div class="grid grid-cols-2 gap-2">
                    <div><span class="text-emerald-500">নাম (বাং):</span> ${fmt(app.nomineeName_bn)}</div>
                    <div><span class="text-emerald-500">Name (Eng):</span> ${fmt(app.nomineeName_en)}</div>
                    <div><span class="text-emerald-500">সম্পর্ক:</span> ${fmt(app.nomineeRelation)}</div>
                    <div><span class="text-emerald-500">মোবাইল:</span> ${fmt(app.nomineePhone)}</div>
                    <div><span class="text-emerald-500">NID:</span> ${fmt(app.nomineeNID)}</div>
                    <div><span class="text-emerald-500">ঠিকানা:</span> ${fmt(app.nomineeAddress)}</div>
                </div>
            </div>

            ${app.sigData ? `<div class="mb-4"><p class="text-xs text-emerald-500 mb-1">স্বাক্ষর:</p><img src="${app.sigData}" style="height:36px;object-fit:contain;background:#fff;padding:4px;border-radius:4px;" /></div>` : ''}

            <div>
                <p class="text-emerald-400 font-bold text-sm mb-2">অনুমোদনের ধাপসমূহ</p>
                ${['committee1', 'committee2', 'committee3', 'committee4'].map(c => {
            const done = committee.includes(c);
            return `<div class="approval-step ${done ? 'done' : ''}">
                        <span class="text-xs font-semibold">${ROLE_LABELS[c]}</span>
                        <span class="step-badge ${done ? 'tag-done' : 'tag-pending-step'} ml-2">${done ? '✅ অনুমোদিত' : '⏳ অপেক্ষমাণ'}</span>
                    </div>`;
        }).join('')}
                ${['secretary', 'vicePresident', 'president'].map(r => {
            const done = !!approvals[r];
            return `<div class="approval-step ${done ? 'done' : ''}">
                        <span class="text-xs font-semibold">${ROLE_LABELS[r]}</span>
                        <span class="step-badge ${done ? 'tag-done' : 'tag-pending-step'} ml-2">${done ? '✅ অনুমোদিত' : '⏳ অপেক্ষমাণ'}</span>
                    </div>`;
        }).join('')}
            </div>
        `;

        document.getElementById('detailModal').classList.remove('hidden');
    }

    // ── APPROVE STEP ──
    async function doApproveStep() {
        if (!currentAdmin) {
            showToast('প্রথমে লগইন করুন', '#e53e3e');
            return;
        }

        if (!selectedAppID) return;

        try {
            const result = await approveStep(selectedAppID, currentAdmin);
            showToast(result.message || 'অনুমোদন সম্পন্ন হয়েছে', '#065F46');
            await renderTable();
            openDetail(selectedAppID);

        } catch (error) {
            console.error('[Admin] Approve error:', error);
        }
    }

    // ── REJECT ──
    async function doReject() {
        if (!currentAdmin) {
            showToast('প্রথমে লগইন করুন', '#e53e3e');
            return;
        }

        if (!confirm('এই আবেদনটি প্রত্যাখ্যান করবেন?')) return;

        try {
            await updateApp(selectedAppID, { status: 'rejected' });
            document.getElementById('detailModal').classList.add('hidden');
            showToast('আবেদন প্রত্যাখ্যান করা হয়েছে', '#e53e3e');
            await renderTable();

        } catch (error) {
            console.error('[Admin] Reject error:', error);
        }
    }

    // ── MEMBER ID ──
    function openMemberIDModal(id) {
        selectedAppID = id;
        document.getElementById('memberIDInput').value = '';
        document.getElementById('memberIDModal').classList.remove('hidden');
    }

    async function saveMemberID() {
        const mid = document.getElementById('memberIDInput').value.trim();
        if (!mid) {
            showToast('সদস্য আইডি লিখুন', '#e53e3e');
            return;
        }

        try {
            await updateApp(selectedAppID, { memberID: mid, status: 'approved' });
            document.getElementById('memberIDModal').classList.add('hidden');
            showToast('সদস্য আইডি সংরক্ষিত: ' + mid, '#065F46');
            await renderTable();

        } catch (error) {
            console.error('[Admin] Save member ID error:', error);
        }
    }

    // ── PDF ──
    async function downloadAdminPDF() {
        const app = applications.find(a => a.id === selectedAppID);
        if (!app) {
            showToast('আবেদন পাওয়া যায়নি', '#e53e3e');
            return;
        }

        if (typeof window.jspdf === 'undefined' || typeof html2canvas === 'undefined') {
            showToast('PDF লাইব্রেরি লোড হয়নি', '#e53e3e');
            return;
        }

        showToast('A4 PDF তৈরি হচ্ছে...', '#065F46');

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        const div = buildAdminPrintDiv(app);
        document.body.appendChild(div);

        try {
            const canvas = await html2canvas(div, { scale: 2, useCORS: true, backgroundColor: '#ffffff', width: 794 });
            document.body.removeChild(div);

            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            const pdfW = 210;
            const pdfH = (canvas.height * 210) / canvas.width;
            const pageH = 297;

            let yPos = 0;
            let first = true;
            while (yPos < pdfH) {
                if (!first) doc.addPage();
                doc.addImage(imgData, 'JPEG', 0, -yPos, pdfW, pdfH);
                yPos += pageH;
                first = false;
            }

            doc.save('BF-member-' + (app.memberID || app.id) + '.pdf');
            showToast('পিডিএফ ডাউনলোড হয়েছে ✅', '#065F46');

        } catch (err) {
            if (document.body.contains(div)) document.body.removeChild(div);
            showToast('পিডিএফ তৈরিতে সমস্যা', '#e53e3e');
            console.error('[Admin] PDF error:', err);
        }
    }

    function buildAdminPrintDiv(d) {
        const div = document.createElement('div');
        div.style.cssText = 'position:fixed;top:-9999px;left:0;width:794px;background:#fff;font-family:"Noto Serif Bengali",serif;color:#111;padding:36px;box-sizing:border-box;';

        const fmt = v => v || '—';
        const approvals = d.approvals || {};
        const committee = approvals.committee || [];
        const dateStr = d.submittedAt ? new Date(d.submittedAt).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';

        div.innerHTML = `
            <div style="text-align:center;border-bottom:3px solid #C9A227;padding-bottom:14px;margin-bottom:18px;">
                <h1 style="font-size:20px;color:#064E3B;margin:0 0 4px;">বারাকাহ ফাইন্যান্স – Barakah Finance</h1>
                <p style="color:#C9A227;margin:0 0 2px;font-size:13px;">সুদমুক্ত লেনদেনে সমৃদ্ধি সবার</p>
                <p style="font-size:10px;color:#666;margin:0;">আদিতমারী, লালমনিরহাট | +8801581093611</p>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
                <div>
                    <h2 style="font-size:15px;color:#064E3B;margin:0 0 5px;border-left:4px solid #C9A227;padding-left:8px;">সদস্য পদের জন্য আবেদন</h2>
                    <div style="font-size:11px;color:#555;line-height:1.8;">
                        <p style="margin:0;">সদস্য আইডি: <strong style="color:#064E3B;font-size:13px;">${d.memberID || '_____________'}</strong></p>
                        <p style="margin:0;">রেফারেন্স: ${d.id}</p>
                        <p style="margin:0;">জমার তারিখ: ${dateStr}</p>
                        <p style="margin:0;">অবস্থা: <strong style="color:${d.status === 'approved' ? '#065F46' : d.status === 'rejected' ? '#dc2626' : '#92400e'}">${d.status === 'approved' ? '✅ অনুমোদিত' : d.status === 'rejected' ? '❌ প্রত্যাখ্যাত' : '⏳ পেন্ডিং'}</strong></p>
                    </div>
                </div>
                ${d.photoData ? `<div style="text-align:center;"><img src="${d.photoData}" style="width:72px;height:88px;object-fit:cover;border:2px solid #C9A227;" /><p style="font-size:9px;color:#888;margin:3px 0 0;">পাসপোর্ট ছবি</p></div>` : ''}
            </div>

            <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px;border:1px solid #d1fae5;">
                <tr style="background:#064E3B;color:#fff;"><th colspan="4" style="padding:6px 10px;text-align:left;">১। আবেদনকারীর ব্যক্তিগত তথ্য</th></tr>
                <tr><td style="padding:5px 10px;color:#065F46;font-weight:600;width:25%;">নাম (বাংলা)</td><td style="padding:5px 10px;width:25%;">${fmt(d.applicantNameBn)}</td><td style="padding:5px 10px;color:#065F46;font-weight:600;width:25%;">Name (English)</td><td style="padding:5px 10px;">${fmt(d.applicantNameEn)}</td></tr>
                <tr style="background:#f0fdf4;"><td style="padding:5px 10px;color:#065F46;font-weight:600;">পিতার নাম (বাং)</td><td style="padding:5px 10px;">${fmt(d.fatherNameBn)}</td><td style="padding:5px 10px;color:#065F46;font-weight:600;">Father (Eng)</td><td style="padding:5px 10px;">${fmt(d.fatherNameEn)}</td></tr>
                <tr><td style="padding:5px 10px;color:#065F46;font-weight:600;">মাতার নাম (বাং)</td><td style="padding:5px 10px;">${fmt(d.motherNameBn)}</td><td style="padding:5px 10px;color:#065F46;font-weight:600;">Mother (Eng)</td><td style="padding:5px 10px;">${fmt(d.motherNameEn)}</td></tr>
                <tr style="background:#f0fdf4;"><td style="padding:5px 10px;color:#065F46;font-weight:600;">এনআইডি</td><td style="padding:5px 10px;">${fmt(d.nidNumber)}</td><td style="padding:5px 10px;color:#065F46;font-weight:600;">জন্ম তারিখ</td><td style="padding:5px 10px;">${fmt(d.dob)}</td></tr>
                <tr><td style="padding:5px 10px;color:#065F46;font-weight:600;">পেশা</td><td style="padding:5px 10px;">${fmt(d.occupation)}</td><td style="padding:5px 10px;color:#065F46;font-weight:600;">আয়ের উৎস</td><td style="padding:5px 10px;">${fmt(d.incomeSource)}</td></tr>
                <tr style="background:#f0fdf4;"><td style="padding:5px 10px;color:#065F46;font-weight:600;">বর্তমান ঠিকানা</td><td colspan="3" style="padding:5px 10px;">${fmt(d.currentAddress)}</td></tr>
                <tr><td style="padding:5px 10px;color:#065F46;font-weight:600;">স্থায়ী ঠিকানা</td><td colspan="3" style="padding:5px 10px;">${fmt(d.permanentAddress)}</td></tr>
                <tr style="background:#f0fdf4;"><td style="padding:5px 10px;color:#065F46;font-weight:600;">মোবাইল</td><td colspan="3" style="padding:5px 10px;">${(d.phones || []).join(' | ')}</td></tr>
            </table>

            <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:12px;border:1px solid #d1fae5;">
                <tr style="background:#064E3B;color:#fff;"><th colspan="4" style="padding:6px 10px;text-align:left;">২। নমিনির তথ্য</th></tr>
                <tr><td style="padding:5px 10px;color:#065F46;font-weight:600;width:25%;">নাম (বাংলা)</td><td style="padding:5px 10px;">${fmt(d.nomineeName_bn)}</td><td style="padding:5px 10px;color:#065F46;font-weight:600;width:25%;">Name (Eng)</td><td style="padding:5px 10px;">${fmt(d.nomineeName_en)}</td></tr>
                <tr style="background:#f0fdf4;"><td style="padding:5px 10px;color:#065F46;font-weight:600;">সম্পর্ক</td><td style="padding:5px 10px;">${fmt(d.nomineeRelation)}</td><td style="padding:5px 10px;color:#065F46;font-weight:600;">মোবাইল</td><td style="padding:5px 10px;">${fmt(d.nomineePhone)}</td></tr>
                <tr><td style="padding:5px 10px;color:#065F46;font-weight:600;">এনআইডি</td><td style="padding:5px 10px;">${fmt(d.nomineeNID)}</td><td style="padding:5px 10px;color:#065F46;font-weight:600;">ঠিকানা</td><td style="padding:5px 10px;">${fmt(d.nomineeAddress)}</td></tr>
            </table>

            <div style="background:#fffbeb;border:1px solid #C9A227;border-radius:6px;padding:10px;font-size:10px;margin-bottom:14px;line-height:1.7;">
                <p style="font-weight:bold;margin:0 0 4px;color:#064E3B;">আর্থিক অঙ্গীকার ও শর্তাবলী:</p>
                <p style="margin:1px 0;">ক) প্রতি মাসের ১৫ তারিখের মধ্যে ২০০০ টাকা সঞ্চয় জমা দিতে বাধ্য থাকব।</p>
                <p style="margin:1px 0;">খ) নির্ধারিত সময়ে জমা না দিলে ১০০ টাকা বিলম্ব ফি প্রযোজ্য।</p>
                <p style="margin:1px 0;">গ) প্রাথমিক ৩ বছর সক্রিয় সদস্য থাকার প্রতিশ্রুতি।</p>
                <p style="margin:1px 0;">ঘ) সংস্থার শৃঙ্খলা লঙ্ঘনে সদস্যপদ বাতিলযোগ্য।</p>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:flex-end;border-top:1px solid #e5e7eb;padding-top:14px;margin-bottom:18px;">
                <div>
                    <p style="font-size:10px;color:#555;margin:0 0 4px;">আবেদনকারীর স্বাক্ষর:</p>
                    ${d.sigData ? `<img src="${d.sigData}" style="height:34px;width:140px;object-fit:contain;border-bottom:1px solid #333;" />` : '<div style="width:140px;border-bottom:1px solid #333;height:34px;"></div>'}
                    <p style="font-size:10px;color:#777;margin:2px 0 0;">${dateStr}</p>
                </div>
                <div style="text-align:right;font-size:10px;color:#555;">
                    <p style="margin:0;">রেফারেন্স: <strong>${d.id}</strong></p>
                    ${d.memberID ? `<p style="margin:2px 0 0;font-size:12px;color:#064E3B;font-weight:bold;">সদস্য আইডি: ${d.memberID}</p>` : ''}
                </div>
            </div>

            <div style="border:1px solid #C9A227;border-radius:6px;padding:10px;margin-bottom:12px;">
                <p style="font-size:10px;color:#064E3B;font-weight:bold;margin:0 0 8px;text-align:center;">আহ্বায়ক কমিটির অনুমোদন</p>
                <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center;font-size:10px;">
                    ${['committee1', 'committee2', 'committee3', 'committee4'].map((c, i) => `
                        <div style="border:1px solid #d1fae5;border-radius:4px;padding:8px;">
                            <p style="margin:0;font-weight:600;color:${committee.includes(c) ? '#065F46' : '#aaa'};">${committee.includes(c) ? '✅' : '___________'}</p>
                            <p style="margin:4px 0 0;color:#555;">কমিটি (0${i + 1})</p>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center;font-size:10px;">
                <div style="border-top:1px solid #333;padding-top:6px;">
                    <p style="margin:0;font-weight:600;">${approvals.secretary ? '✅ ' + (new Date().toLocaleDateString('bn-BD')) : '_______________'}</p>
                    <p style="margin:4px 0 0;color:#555;">সাধারণ সম্পাদক (সুপারিশকারী)</p>
                </div>
                <div style="border-top:1px solid #333;padding-top:6px;">
                    <p style="margin:0;font-weight:600;">${approvals.vicePresident ? '✅ ' + (new Date().toLocaleDateString('bn-BD')) : '_______________'}</p>
                    <p style="margin:4px 0 0;color:#555;">সহ-সভাপতি (অনুমোদনকারী)</p>
                </div>
                <div style="border-top:1px solid #333;padding-top:6px;">
                    <p style="margin:0;font-weight:600;">${approvals.president ? '✅ ' + (new Date().toLocaleDateString('bn-BD')) : '_______________'}</p>
                    <p style="margin:4px 0 0;color:#555;">সভাপতি (চূড়ান্ত অনুমোদন)</p>
                </div>
            </div>
        `;

        return div;
    }

    // ── CSV EXPORT ──
    function exportCSV() {
        if (!applications.length) {
            showToast('কোনো ডেটা নেই', '#C9A227');
            return;
        }

        const headers = ['ID', 'সদস্য_ID', 'নাম_বাংলা', 'নাম_ইংরেজি', 'NID', 'জন্ম_তারিখ', 'পেশা', 'মোবাইল', 'অবস্থা', 'জমার_তারিখ'];
        const rows = applications.map(a => [
            a.id, a.memberID || '',
            a.applicantNameBn || '', a.applicantNameEn || '',
            a.nidNumber || '', a.dob || '', a.occupation || '',
            (a.phones || [])[0] || '', a.status || '',
            a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : ''
        ]);

        const csv = [headers, ...rows]
            .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
            .join('\n');

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'barakah-members-' + new Date().toISOString().slice(0, 10) + '.csv';
        link.click();

        showToast('CSV ডাউনলোড হয়েছে', '#065F46');
    }

    // ── INIT ──
    document.addEventListener('DOMContentLoaded', function () {
        checkSession();
        // Add search listener
        document.getElementById('searchBox').addEventListener('input', renderTable);
    });

    // ── Expose Globally ──
    window.showLoginModal = showLoginModal;
    window.doLogin = doLogin;
    window.adminLogout = adminLogout;
    window.setFilter = setFilter;
    window.renderTable = renderTable;
    window.goToPage = goToPage;
    window.openDetail = openDetail;
    window.doApproveStep = doApproveStep;
    window.doReject = doReject;
    window.openMemberIDModal = openMemberIDModal;
    window.saveMemberID = saveMemberID;
    window.downloadAdminPDF = downloadAdminPDF;
    window.exportCSV = exportCSV;
    window.showToast = showToast;

})();