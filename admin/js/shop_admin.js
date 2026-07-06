// C:\Project\barakah_finance2\admin\js\shop_admin.js

(function () {
    'use strict';

    // ── Constants ──
    const API_BASE = window.location.hostname === 'localhost'
        ? 'http://localhost:3001/api'
        : '/api';

    const DEBUG = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // ── State ──
    let productModal_editing = false;
    let orderFilter = 'all';
    let selectedOrderId = null;
    let currentPage = 1;
    let totalPages = 1;
    let products = [];
    let orders = [];

    // ── Helper: API Call ──
    async function apiFetch(path, options = {}) {
        const token = localStorage.getItem('bf_admin_token');
        if (!token) {
            window.location.href = '../admin.html';
            throw new Error('UNAUTHORIZED');
        }

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        };

        try {
            const response = await fetch(`${API_BASE}${path}`, {
                ...options,
                headers
            });

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('bf_admin_token');
                    window.location.href = '../admin.html';
                    throw new Error('SESSION_EXPIRED');
                }
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || `HTTP ${response.status}`);
            }

            return await response.json();

        } catch (error) {
            if (error.message !== 'SESSION_EXPIRED') {
                console.error('[ShopAdmin] API error:', error);
            }
            throw error;
        }
    }

    // ── Toast ──
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
        if (!document.querySelector('style[data-shopadmin-toast]')) {
            const style = document.createElement('style');
            style.dataset.shopadminToast = '1';
            style.textContent = `
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(15px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }
    })();

    // ── EMI Calc ──
    function calcEmi(price) {
        const total = Math.round(price * 1.10);
        const perInstall = Math.round(total / 6);
        return { total, perInstall, profit: Math.round(price * 0.10) };
    }

    function fmtBn(n) {
        return '৳' + Number(n).toLocaleString('bn');
    }

    // ── Auth Check ──
    function checkAuth() {
        const token = localStorage.getItem('bf_admin_token');
        if (!token) {
            window.location.href = '../admin.html';
            return false;
        }
        return true;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ── TABS ──
    // ═══════════════════════════════════════════════════════════════════

    function switchTab(name, btn) {
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.getElementById('tab-' + name).classList.add('active');
        if (btn) btn.classList.add('active');

        if (name === 'products') { currentPage = 1; renderProductTable(); }
        if (name === 'orders') { currentPage = 1; renderOrderTable(); }
        if (name === 'badges') renderBadgeTable();
        if (name === 'notices') renderNoticeTable();
    }

    // ═══════════════════════════════════════════════════════════════════
    // ── STATS ──
    // ═══════════════════════════════════════════════════════════════════

    function updateStats() {
        document.getElementById('stat-products').textContent = products.length || 0;
        document.getElementById('stat-orders').textContent = orders.length || 0;
        document.getElementById('stat-badges').textContent = getBadges().length || 0;
        document.getElementById('stat-notices').textContent = getNotices().length || 0;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ── PRODUCTS ──
    // ═══════════════════════════════════════════════════════════════════

    async function getProducts() {
        try {
            const result = await apiFetch(`/products?page=${currentPage}&limit=20`);
            products = result.products || [];
            totalPages = result.pagination?.totalPages || 1;
            return products;
        } catch (error) {
            if (error.message !== 'SESSION_EXPIRED') {
                toast('পণ্য লোড করতে সমস্যা', '#e53e3e');
            }
            return [];
        }
    }

    async function saveProductToAPI(product) {
        try {
            if (product.id && product.id.startsWith('P-')) {
                // Update existing
                return await apiFetch(`/products/${product.id}`, {
                    method: 'PUT',
                    body: JSON.stringify(product)
                });
            } else {
                // Create new
                return await apiFetch('/products', {
                    method: 'POST',
                    body: JSON.stringify(product)
                });
            }
        } catch (error) {
            throw error;
        }
    }

    async function deleteProductFromAPI(id) {
        return await apiFetch(`/products/${id}`, { method: 'DELETE' });
    }

    async function toggleProductStock(id) {
        const product = products.find(p => p.id === id);
        if (!product) return;
        return await apiFetch(`/products/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ inStock: !product.inStock })
        });
    }

    async function renderProductTable() {
        if (!checkAuth()) return;

        await getProducts();

        const search = (document.getElementById('pSearch')?.value || '').toLowerCase();
        let filtered = products.filter(p =>
            !search || p.name.toLowerCase().includes(search) || (p.category || '').toLowerCase().includes(search)
        );

        const table = document.getElementById('productTableBody');
        if (!filtered.length) {
            table.innerHTML = '<tr><td colspan="8" class="text-center text-gray-500 py-6">কোনো পণ্য নেই</td></tr>';
            return;
        }

        table.innerHTML = filtered.map(p => {
            const emi = calcEmi(p.price);
            return `
                <tr>
                    <td class="text-xl">${p.emoji || '📦'}</td>
                    <td class="font-semibold">${p.name}</td>
                    <td><span class="tag" style="background:rgba(6,95,70,0.3);color:#a7f3d0;">${p.category || '—'}</span></td>
                    <td>${fmtBn(p.price)}</td>
                    <td class="text-yellow-400">${fmtBn(emi.perInstall)}</td>
                    <td><span class="tag ${p.inStock ? 'tag-ok' : 'tag-no'}">${p.inStock ? '✅ আছে' : '❌ নেই'}</span></td>
                    <td>${p.featured ? '<span class="tag tag-feat">⭐ হ্যাঁ</span>' : '<span style="color:#666;">না</span>'}</td>
                    <td>
                        <div class="flex gap-1 flex-wrap">
                            <button onclick="editProduct('${p.id}')" class="btn-y text-xs py-1 px-2">✏️ সম্পাদনা</button>
                            <button onclick="deleteProduct('${p.id}')" class="btn-r text-xs py-1 px-2">🗑️</button>
                            <button onclick="toggleStock('${p.id}')" class="btn-g text-xs py-1 px-2">${p.inStock ? 'স্টক বন্ধ' : 'স্টক চালু'}</button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');

        renderProductPagination();
        updateStats();
    }

    function renderProductPagination() {
        const container = document.getElementById('productPagination');
        if (!container) return;

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = `<div class="flex gap-2 justify-center mt-4">`;
        for (let i = 1; i <= totalPages; i++) {
            html += `<button onclick="goToProductPage(${i})" class="px-3 py-1 rounded ${i === currentPage ? 'bg-emerald-700 text-white' : 'bg-emerald-900/30 text-emerald-300'}">${i}</button>`;
        }
        html += `</div>`;
        container.innerHTML = html;
    }

    function goToProductPage(page) {
        currentPage = page;
        renderProductTable();
    }

    // ── Product Modal ──
    function openProductModal(id = null) {
        productModal_editing = !!id;
        document.getElementById('productModalTitle').textContent = id ? 'পণ্য সম্পাদনা' : 'নতুন পণ্য যোগ করুন';

        if (id) {
            const p = products.find(x => x.id === id);
            if (!p) {
                toast('পণ্য পাওয়া যায়নি', '#e53e3e');
                return;
            }
            document.getElementById('p-name').value = p.name || '';
            document.getElementById('p-cat').value = p.category || '';
            document.getElementById('p-price').value = p.price || '';
            document.getElementById('p-emoji').value = p.emoji || '';
            document.getElementById('p-desc').value = p.description || '';
            document.getElementById('p-images').value = (p.images || []).join(', ');
            document.getElementById('p-instock').checked = !!p.inStock;
            document.getElementById('p-featured').checked = !!p.featured;
            document.getElementById('p-edit-id').value = id;
            previewEmi();
        } else {
            ['p-name', 'p-cat', 'p-emoji', 'p-desc', 'p-images'].forEach(i => document.getElementById(i).value = '');
            document.getElementById('p-price').value = '';
            document.getElementById('p-instock').checked = true;
            document.getElementById('p-featured').checked = false;
            document.getElementById('p-edit-id').value = '';
            document.getElementById('emiPreview').classList.add('hidden');
        }

        document.getElementById('productModal').classList.remove('hidden');
    }

    function closeProductModal() {
        document.getElementById('productModal').classList.add('hidden');
    }

    function previewEmi() {
        const price = parseFloat(document.getElementById('p-price').value) || 0;
        if (!price) {
            document.getElementById('emiPreview').classList.add('hidden');
            return;
        }
        const { total, perInstall, profit } = calcEmi(price);
        document.getElementById('emiPreviewRows').innerHTML = `
            <div style="display:flex;justify-content:space-between;"><span>মূল মূল্য:</span><span>${fmtBn(price)}</span></div>
            <div style="display:flex;justify-content:space-between;"><span>লাভ (১০%):</span><span>${fmtBn(profit)}</span></div>
            <div style="display:flex;justify-content:space-between;font-weight:700;color:#F5D061;"><span>মোট:</span><span>${fmtBn(total)}</span></div>
            <div style="display:flex;justify-content:space-between;"><span>প্রতি কিস্তি (৬টি):</span><span>${fmtBn(perInstall)}</span></div>
        `;
        document.getElementById('emiPreview').classList.remove('hidden');
    }

    async function saveProduct() {
        try {
            const name = document.getElementById('p-name').value.trim();
            const cat = document.getElementById('p-cat').value.trim();
            const price = parseFloat(document.getElementById('p-price').value);
            const editId = document.getElementById('p-edit-id').value;

            if (!name || !cat || !price) {
                toast('নাম, ক্যাটাগরি ও মূল্য পূরণ করুন।', '#e53e3e');
                return;
            }

            const images = document.getElementById('p-images').value.split(',').map(s => s.trim()).filter(Boolean);

            const product = {
                name,
                category: cat,
                price,
                emoji: document.getElementById('p-emoji').value.trim() || '📦',
                description: document.getElementById('p-desc').value.trim(),
                images,
                inStock: document.getElementById('p-instock').checked,
                featured: document.getElementById('p-featured').checked
            };

            if (editId) product.id = editId;

            const result = await saveProductToAPI(product);
            toast(editId ? 'পণ্য আপডেট হয়েছে ✅' : 'নতুন পণ্য যোগ হয়েছে ✅');
            closeProductModal();
            await renderProductTable();

        } catch (error) {
            console.error('[ShopAdmin] Save product error:', error);
            toast('পণ্য সংরক্ষণে সমস্যা', '#e53e3e');
        }
    }

    function editProduct(id) {
        openProductModal(id);
    }

    async function deleteProduct(id) {
        if (!confirm('এই পণ্যটি মুছে দেবেন?')) return;

        try {
            await deleteProductFromAPI(id);
            toast('পণ্য মুছে দেওয়া হয়েছে।', '#e53e3e');
            await renderProductTable();
        } catch (error) {
            console.error('[ShopAdmin] Delete product error:', error);
            toast('পণ্য মুছতে সমস্যা', '#e53e3e');
        }
    }

    async function toggleStock(id) {
        try {
            await toggleProductStock(id);
            toast('স্টক অবস্থা আপডেট হয়েছে।');
            await renderProductTable();
        } catch (error) {
            console.error('[ShopAdmin] Toggle stock error:', error);
            toast('স্টক আপডেটে সমস্যা', '#e53e3e');
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // ── ORDERS ──
    // ═══════════════════════════════════════════════════════════════════

    async function getOrders() {
        try {
            const result = await apiFetch(`/orders?page=${currentPage}&limit=20&status=${orderFilter}`);
            orders = result.orders || [];
            totalPages = result.pagination?.totalPages || 1;
            return orders;
        } catch (error) {
            if (error.message !== 'SESSION_EXPIRED') {
                toast('অর্ডার লোড করতে সমস্যা', '#e53e3e');
            }
            return [];
        }
    }

    async function updateOrder(id, data) {
        return await apiFetch(`/orders/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
    }

    function setOrderFilter(filter, btn) {
        orderFilter = filter;
        currentPage = 1;
        document.querySelectorAll('#tab-orders .tab-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        renderOrderTable();
    }

    async function renderOrderTable() {
        if (!checkAuth()) return;

        await getOrders();

        const table = document.getElementById('orderTableBody');
        if (!orders.length) {
            table.innerHTML = '<tr><td colspan="8" class="text-center text-gray-500 py-6">কোনো অর্ডার নেই</td></tr>';
            return;
        }

        const statusMap = {
            pending: 'tag-pend',
            approved: 'tag-ok',
            rejected: 'tag-no',
            processing: 'tag-feat',
            delivered: 'tag-ok'
        };
        const statusLabel = {
            pending: 'পেন্ডিং',
            approved: 'অনুমোদিত',
            rejected: 'বাতিল',
            processing: 'প্রসেসিং',
            delivered: 'বিতরিত'
        };

        table.innerHTML = orders.slice().reverse().map(o => {
            const date = o.submittedAt ? new Date(o.submittedAt).toLocaleDateString('bn-BD') : '—';
            return `
                <tr>
                    <td class="font-mono text-xs text-yellow-300">${o.id}</td>
                    <td class="font-semibold text-xs">${o.productName || '—'}</td>
                    <td>${o.customerName || '—'}</td>
                    <td class="text-xs">${o.customerPhone || '—'}</td>
                    <td>${fmtBn(o.totalPayable || 0)}</td>
                    <td class="text-xs">${date}</td>
                    <td><span class="tag ${statusMap[o.status] || 'tag-pend'}">${statusLabel[o.status] || o.status}</span></td>
                    <td><button onclick="openOrderDetail('${o.id}')" class="btn-g text-xs py-1 px-2">বিস্তারিত</button></td>
                </tr>
            `;
        }).join('');

        renderOrderPagination();
        updateStats();
    }

    function renderOrderPagination() {
        const container = document.getElementById('orderPagination');
        if (!container) return;

        if (totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = `<div class="flex gap-2 justify-center mt-4">`;
        for (let i = 1; i <= totalPages; i++) {
            html += `<button onclick="goToOrderPage(${i})" class="px-3 py-1 rounded ${i === currentPage ? 'bg-emerald-700 text-white' : 'bg-emerald-900/30 text-emerald-300'}">${i}</button>`;
        }
        html += `</div>`;
        container.innerHTML = html;
    }

    function goToOrderPage(page) {
        currentPage = page;
        renderOrderTable();
    }

    function openOrderDetail(id) {
        selectedOrderId = id;
        const o = orders.find(x => x.id === id);
        if (!o) {
            toast('অর্ডার পাওয়া যায়নি', '#e53e3e');
            return;
        }

        const emi = calcEmi(o.price || 0);
        document.getElementById('statusStepSel').value = o.statusStep || 0;

        document.getElementById('orderDetailContent').innerHTML = `
            <div class="grid grid-cols-2 gap-2 text-xs mb-4">
                <div><span class="text-emerald-400">অর্ডার আইডি:</span><br /><strong class="text-yellow-300">${o.id}</strong></div>
                <div><span class="text-emerald-400">তারিখ:</span><br />${o.submittedAt ? new Date(o.submittedAt).toLocaleDateString('bn-BD') : '—'}</div>
                <div><span class="text-emerald-400">পণ্য:</span><br />${o.productName || '—'}</div>
                <div><span class="text-emerald-400">মূল্য:</span><br />${fmtBn(o.price || 0)}</div>
                <div><span class="text-emerald-400">মোট পরিশোধযোগ্য:</span><br />${fmtBn(o.totalPayable || emi.total)}</div>
                <div><span class="text-emerald-400">প্রতি কিস্তি:</span><br />${fmtBn(o.perInstall || emi.perInstall)} × ৬</div>
            </div>
            <div class="bg-black/20 rounded-lg p-3 text-xs mb-3">
                <p class="text-emerald-400 font-bold mb-1">গ্রাহকের তথ্য</p>
                <div class="grid grid-cols-2 gap-1">
                    <div><span class="text-emerald-500">নাম:</span> ${o.customerName || '—'}</div>
                    <div><span class="text-emerald-500">মোবাইল:</span> ${o.customerPhone || '—'}</div>
                    <div><span class="text-emerald-500">NID:</span> ${o.nid || '—'}</div>
                    <div><span class="text-emerald-500">ঠিকানা:</span> ${o.address || '—'}</div>
                    <div class="col-span-2"><span class="text-emerald-500">স্বাক্ষী:</span> ${o.witness || '—'}</div>
                    <div class="col-span-2"><span class="text-emerald-500">মন্তব্য:</span> ${o.note || '—'}</div>
                </div>
            </div>
        `;

        document.getElementById('orderDetailModal').classList.remove('hidden');
    }

    async function updateOrderStatus(status) {
        if (!selectedOrderId) return;
        try {
            await updateOrder(selectedOrderId, { status });
            document.getElementById('orderDetailModal').classList.add('hidden');
            toast('অর্ডার অবস্থা আপডেট হয়েছে: ' + status);
            await renderOrderTable();
        } catch (error) {
            console.error('[ShopAdmin] Update order status error:', error);
            toast('অর্ডার আপডেটে সমস্যা', '#e53e3e');
        }
    }

    async function saveStatusStep() {
        if (!selectedOrderId) return;
        const step = parseInt(document.getElementById('statusStepSel').value);
        try {
            await updateOrder(selectedOrderId, { statusStep: step });
            document.getElementById('orderDetailModal').classList.add('hidden');
            toast('ধাপ আপডেট হয়েছে: ' + step);
            await renderOrderTable();
        } catch (error) {
            console.error('[ShopAdmin] Save status step error:', error);
            toast('ধাপ আপডেটে সমস্যা', '#e53e3e');
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // ── BADGES ──
    // ═══════════════════════════════════════════════════════════════════

    function getBadges() {
        try {
            return JSON.parse(localStorage.getItem('bf_badges')) || DEFAULT_BADGES;
        } catch {
            return DEFAULT_BADGES;
        }
    }

    function saveBadges(arr) {
        localStorage.setItem('bf_badges', JSON.stringify(arr));
    }

    const DEFAULT_BADGES = [
        { id: 'b1', key: 'members', label: 'মোট সদস্য', icon: '👥', show: true, clickable: true },
        { id: 'b2', key: 'savings', label: 'মোট সঞ্চয়', icon: '💰', show: true, clickable: true },
        { id: 'b3', key: 'loans', label: 'করজে হাসানা', icon: '🤝', show: true, clickable: true },
        { id: 'b4', key: 'services', label: 'আমাদের সেবা', icon: '🌟', show: true, clickable: true }
    ];

    function renderBadgeTable() {
        const badges = getBadges();
        const table = document.getElementById('badgeTableBody');
        if (!badges.length) {
            table.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-6">কোনো ব্যাজ নেই</td></tr>';
            return;
        }

        table.innerHTML = badges.map(b => `
            <tr>
                <td class="text-2xl">${b.icon || '🏅'}</td>
                <td class="font-semibold">${b.label || '—'}</td>
                <td><code class="text-yellow-300 text-xs">${b.key}</code></td>
                <td><span class="tag ${b.show ? 'tag-ok' : 'tag-no'}">${b.show ? '✅ হ্যাঁ' : '❌ না'}</span></td>
                <td><span class="tag ${b.clickable ? 'tag-feat' : ''}"> ${b.clickable ? '✅ হ্যাঁ' : 'না'}</span></td>
                <td>
                    <div class="flex gap-1 flex-wrap">
                        <button onclick="editBadge('${b.id}')" class="btn-y text-xs py-1 px-2">✏️</button>
                        <button onclick="toggleBadgeShow('${b.id}')" class="btn-g text-xs py-1 px-2">${b.show ? 'লুকান' : 'দেখান'}</button>
                        <button onclick="deleteBadge('${b.id}')" class="btn-r text-xs py-1 px-2">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');

        updateStats();
    }

    function openBadgeModal(id = null) {
        document.getElementById('badgeModalTitle').textContent = id ? 'ব্যাজ সম্পাদনা' : 'নতুন ব্যাজ যোগ করুন';
        if (id) {
            const b = getBadges().find(x => x.id === id);
            if (!b) return;
            document.getElementById('b-icon').value = b.icon || '';
            document.getElementById('b-label').value = b.label || '';
            document.getElementById('b-key').value = b.key || 'members';
            document.getElementById('b-custom-val').value = b.customVal || '';
            document.getElementById('b-show').checked = !!b.show;
            document.getElementById('b-clickable').checked = !!b.clickable;
            document.getElementById('b-edit-id').value = id;
        } else {
            ['b-icon', 'b-label', 'b-custom-val'].forEach(i => document.getElementById(i).value = '');
            document.getElementById('b-key').value = 'members';
            document.getElementById('b-show').checked = true;
            document.getElementById('b-clickable').checked = true;
            document.getElementById('b-edit-id').value = '';
        }
        document.getElementById('badgeModal').classList.remove('hidden');
    }

    function closeBadgeModal() {
        document.getElementById('badgeModal').classList.add('hidden');
    }

    function saveBadge() {
        const icon = document.getElementById('b-icon').value.trim();
        const label = document.getElementById('b-label').value.trim();
        const key = document.getElementById('b-key').value;
        if (!label) {
            toast('নাম/লেবেল দিন।', '#e53e3e');
            return;
        }

        const badges = getBadges();
        const editId = document.getElementById('b-edit-id').value;
        const badge = {
            id: editId || 'b-' + Date.now().toString(36),
            icon: icon || '🏅',
            label,
            key,
            customVal: document.getElementById('b-custom-val').value.trim(),
            show: document.getElementById('b-show').checked,
            clickable: document.getElementById('b-clickable').checked
        };

        if (editId) {
            const idx = badges.findIndex(b => b.id === editId);
            if (idx >= 0) badges[idx] = badge;
        } else {
            badges.push(badge);
        }

        saveBadges(badges);
        closeBadgeModal();
        renderBadgeTable();
        updateStats();
        toast('ব্যাজ সংরক্ষিত ✅');
    }

    function editBadge(id) { openBadgeModal(id); }

    function deleteBadge(id) {
        if (!confirm('এই ব্যাজটি মুছবেন?')) return;
        saveBadges(getBadges().filter(b => b.id !== id));
        renderBadgeTable();
        updateStats();
        toast('ব্যাজ মুছে দেওয়া হয়েছে।', '#e53e3e');
    }

    function toggleBadgeShow(id) {
        const badges = getBadges();
        const idx = badges.findIndex(b => b.id === id);
        if (idx >= 0) badges[idx].show = !badges[idx].show;
        saveBadges(badges);
        renderBadgeTable();
        toast('ব্যাজ দৃশ্যমানতা আপডেট হয়েছে।');
    }

    // ═══════════════════════════════════════════════════════════════════
    // ── NOTICES ──
    // ═══════════════════════════════════════════════════════════════════

    function getNotices() {
        try {
            return JSON.parse(localStorage.getItem('bf_notices')) || DEFAULT_NOTICES;
        } catch {
            return DEFAULT_NOTICES;
        }
    }

    function saveNotices(arr) {
        localStorage.setItem('bf_notices', JSON.stringify(arr));
    }

    const DEFAULT_NOTICES = [
        { id: 'n1', text: '🌙 বারাকাহ ফাইন্যান্সে আপনাকে স্বাগতম! সুদমুক্ত লেনদেনে সমৃদ্ধি সবার।', style: 'bold', color: '#F5D061', active: true },
        { id: 'n2', text: '📢 নতুন সদস্যদের জন্য বিশেষ সুবিধা: আবেদন ফি মাত্র ১০০ টাকা!', style: 'normal', color: '#fff', active: true },
        { id: 'n3', text: '💰 করজে হাসানা: আপদকালীন প্রয়োজনে বিনা সুদে সর্বোচ্চ ১৫,০০০ টাকা।', style: 'italic', color: '#a7f3d0', active: true }
    ];

    function renderNoticeTable() {
        const notices = getNotices();
        const table = document.getElementById('noticeTableBody');
        if (!notices.length) {
            table.innerHTML = '<tr><td colspan="5" class="text-center text-gray-500 py-6">কোনো নোটিশ নেই</td></tr>';
            return;
        }

        const styleMap = { bold: 'মোটা', italic: 'বাঁকা', normal: 'সাধারণ', 'bold-italic': 'মোটা+বাঁকা' };

        table.innerHTML = notices.map(n => `
            <tr>
                <td style="max-width:300px;"><span style="${getNoticeStyle(n)};color:${n.color || '#fff'};">${n.text}</span></td>
                <td><span class="tag" style="background:rgba(100,100,100,0.3);color:#ccc;">${styleMap[n.style] || n.style}</span></td>
                <td><span style="background:${n.color || '#fff'};width:20px;height:20px;border-radius:50%;display:inline-block;border:1px solid #333;"></span> <code class="text-xs text-gray-400">${n.color || '—'}</code></td>
                <td><span class="tag ${n.active ? 'tag-ok' : 'tag-no'}">${n.active ? '✅ সক্রিয়' : '❌ নিষ্ক্রিয়'}</span></td>
                <td>
                    <div class="flex gap-1 flex-wrap">
                        <button onclick="editNotice('${n.id}')" class="btn-y text-xs py-1 px-2">✏️</button>
                        <button onclick="toggleNotice('${n.id}')" class="btn-g text-xs py-1 px-2">${n.active ? 'বন্ধ' : 'চালু'}</button>
                        <button onclick="deleteNotice('${n.id}')" class="btn-r text-xs py-1 px-2">🗑️</button>
                    </div>
                </td>
            </tr>
        `).join('');

        updateStats();
    }

    function getNoticeStyle(n) {
        const styles = {
            bold: 'font-weight:700',
            italic: 'font-style:italic',
            'bold-italic': 'font-weight:700;font-style:italic',
            normal: ''
        };
        return styles[n.style] || '';
    }

    function openNoticeModal(id = null) {
        document.getElementById('noticeModalTitle').textContent = id ? 'নোটিশ সম্পাদনা' : 'নতুন নোটিশ যোগ করুন';
        if (id) {
            const n = getNotices().find(x => x.id === id);
            if (!n) return;
            document.getElementById('n-text').value = n.text || '';
            document.getElementById('n-style').value = n.style || 'normal';
            document.getElementById('n-color').value = n.color || '#ffffff';
            document.getElementById('n-color-hex').value = n.color || '#ffffff';
            document.getElementById('n-active').checked = !!n.active;
            document.getElementById('n-edit-id').value = id;
        } else {
            document.getElementById('n-text').value = '';
            document.getElementById('n-style').value = 'normal';
            document.getElementById('n-color').value = '#ffffff';
            document.getElementById('n-color-hex').value = '#ffffff';
            document.getElementById('n-active').checked = true;
            document.getElementById('n-edit-id').value = '';
        }
        updateNoticePreview();
        document.getElementById('noticeModal').classList.remove('hidden');
    }

    function closeNoticeModal() {
        document.getElementById('noticeModal').classList.add('hidden');
    }

    function updateNoticePreview() {
        const text = document.getElementById('n-text').value || 'পূর্বদর্শন...';
        const color = document.getElementById('n-color').value;
        const style = document.getElementById('n-style').value;
        const styleMap = {
            bold: 'font-weight:700',
            italic: 'font-style:italic',
            'bold-italic': 'font-weight:700;font-style:italic',
            normal: ''
        };
        document.getElementById('n-preview').style.cssText = `color:${color};${styleMap[style] || ''};font-size:13px;font-family:'Noto Serif Bengali',serif;`;
        document.getElementById('n-preview').textContent = text;
    }

    function syncColor() {
        const hex = document.getElementById('n-color-hex').value;
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
            document.getElementById('n-color').value = hex;
            updateNoticePreview();
        }
    }

    function setColor(hex) {
        document.getElementById('n-color').value = hex;
        document.getElementById('n-color-hex').value = hex;
        updateNoticePreview();
    }

    function saveNotice() {
        const text = document.getElementById('n-text').value.trim();
        if (!text) {
            toast('নোটিশ টেক্সট লিখুন।', '#e53e3e');
            return;
        }

        const notices = getNotices();
        const editId = document.getElementById('n-edit-id').value;
        const notice = {
            id: editId || 'n-' + Date.now().toString(36),
            text,
            style: document.getElementById('n-style').value,
            color: document.getElementById('n-color').value,
            active: document.getElementById('n-active').checked
        };

        if (editId) {
            const idx = notices.findIndex(n => n.id === editId);
            if (idx >= 0) notices[idx] = notice;
        } else {
            notices.push(notice);
        }

        saveNotices(notices);
        closeNoticeModal();
        renderNoticeTable();
        updateStats();
        toast('নোটিশ সংরক্ষিত ✅');
    }

    function editNotice(id) { openNoticeModal(id); }

    function deleteNotice(id) {
        if (!confirm('এই নোটিশটি মুছবেন?')) return;
        saveNotices(getNotices().filter(n => n.id !== id));
        renderNoticeTable();
        updateStats();
        toast('নোটিশ মুছে দেওয়া হয়েছে।', '#e53e3e');
    }

    function toggleNotice(id) {
        const notices = getNotices();
        const idx = notices.findIndex(n => n.id === id);
        if (idx >= 0) notices[idx].active = !notices[idx].active;
        saveNotices(notices);
        renderNoticeTable();
        toast('নোটিশ অবস্থা আপডেট হয়েছে।');
    }

    // ── Event Listeners ──
    document.addEventListener('input', function (e) {
        if (['n-text', 'n-style', 'n-color', 'n-color-hex'].includes(e.target?.id)) {
            updateNoticePreview();
        }
        if (e.target?.id === 'p-price') {
            previewEmi();
        }
    });

    document.addEventListener('change', function (e) {
        if (e.target?.id === 'n-color') {
            document.getElementById('n-color-hex').value = e.target.value;
            updateNoticePreview();
        }
    });

    // ── Init ──
    document.addEventListener('DOMContentLoaded', function () {
        if (!checkAuth()) return;

        // Set up search listener
        document.getElementById('pSearch')?.addEventListener('input', renderProductTable);
        document.getElementById('userSearch')?.addEventListener('input', renderAllUsers);

        renderProductTable();
        updateStats();
    });

    // ═══════════════════════════════════════════════════════════════════
    // ── EXPOSE GLOBALLY ──
    // ═══════════════════════════════════════════════════════════════════

    window.switchTab = switchTab;
    window.updateStats = updateStats;
    window.renderProductTable = renderProductTable;
    window.goToProductPage = goToProductPage;
    window.openProductModal = openProductModal;
    window.closeProductModal = closeProductModal;
    window.saveProduct = saveProduct;
    window.editProduct = editProduct;
    window.deleteProduct = deleteProduct;
    window.toggleStock = toggleStock;
    window.previewEmi = previewEmi;

    window.setOrderFilter = setOrderFilter;
    window.renderOrderTable = renderOrderTable;
    window.goToOrderPage = goToOrderPage;
    window.openOrderDetail = openOrderDetail;
    window.updateOrderStatus = updateOrderStatus;
    window.saveStatusStep = saveStatusStep;

    window.renderBadgeTable = renderBadgeTable;
    window.openBadgeModal = openBadgeModal;
    window.closeBadgeModal = closeBadgeModal;
    window.saveBadge = saveBadge;
    window.editBadge = editBadge;
    window.deleteBadge = deleteBadge;
    window.toggleBadgeShow = toggleBadgeShow;

    window.renderNoticeTable = renderNoticeTable;
    window.openNoticeModal = openNoticeModal;
    window.closeNoticeModal = closeNoticeModal;
    window.saveNotice = saveNotice;
    window.editNotice = editNotice;
    window.deleteNotice = deleteNotice;
    window.toggleNotice = toggleNotice;
    window.setColor = setColor;
    window.syncColor = syncColor;

    window.toast = toast;
    window.calcEmi = calcEmi;
    window.fmtBn = fmtBn;

})();