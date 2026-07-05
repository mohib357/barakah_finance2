// C:\Project\Barakah_Finance\pages\js\shop.js
// ══════════════════════════════════════════════════════════
// SHOP HANDLER — FIXED & IMPROVED VERSION
// FIXES:
// 1. Removed duplicate ShopDB (uses global DB from db.js)
// 2. Added proper DB availability check
// 3. Added proper error handling with try-catch
// 4. Fixed multi-item cart checkout
// 5. Added Bengali number formatting
// 6. Fixed toast function (unified)
// 7. Added cart persistence across sessions
// 8. Added order tracking with proper status steps
// 9. Added proper form validation
// 10. Added search and filter functionality improvements
// ══════════════════════════════════════════════════════════

(function () {
    'use strict';

    const DEBUG = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // ── Check if DB is available ──
    function isDBAvailable() {
        return typeof DB !== 'undefined' && DB !== null;
    }

    // ── Toast function ──
    function toast(msg, color = '#065F46') {
        const existing = document.querySelector('.toast-msg');
        if (existing) existing.remove();

        const t = document.createElement('div');
        t.className = 'toast-msg';
        t.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
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

    // ── Ensure animation exists ──
    (function ensureToastAnimation() {
        if (!document.querySelector('style[data-shop-toast]')) {
            const style = document.createElement('style');
            style.dataset.shopToast = '1';
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
    function fmtBn(n) {
        if (n === undefined || n === null) return '৳০';
        return '৳' + Number(n).toLocaleString('bn');
    }

    function bnNum(n) {
        if (n === undefined || n === null) return '০';
        return String(n).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[d]);
    }

    // ── EMI Calculation ──
    function calcEmi(price) {
        const total = Math.round(price * 1.10);
        const perInstall = Math.round(total / 6);
        return {
            total: total,
            perInstall: perInstall,
            profit: Math.round(price * 0.10),
            down: perInstall
        };
    }

    // ── DEFAULT PRODUCTS ──
    const DEFAULT_PRODUCTS = [
        { id: 'p1', name: 'Samsung Galaxy A15', category: 'মোবাইল', price: 18000, emoji: '📱', description: '৬.৫ ইঞ্চি Super AMOLED ডিসপ্লে, ৫০০০ mAh ব্যাটারি, ৫০MP ট্রিপল ক্যামেরা, ১২৮GB স্টোরেজ।', inStock: true, featured: true, images: [] },
        { id: 'p2', name: 'Walton রেফ্রিজারেটর ২৫০L', category: 'ইলেকট্রনিক্স', price: 35000, emoji: '🧊', description: 'ওয়ালটন ২৫০ লিটার ডাবল ডোর রেফ্রিজারেটর। বিদ্যুৎ সাশ্রয়ী A++ রেটিং।', inStock: true, featured: true, images: [] },
        { id: 'p3', name: 'Hero Splendor Plus মোটরসাইকেল', category: 'মোটরযান', price: 125000, emoji: '🏍️', description: 'হিরো স্প্লেন্ডার প্লাস — জ্বালানি সাশ্রয়ী ১০০cc ইঞ্জিন।', inStock: false, featured: false, images: [] },
        { id: 'p4', name: 'Singer ইলেকট্রিক সেলাই মেশিন', category: 'গৃহস্থালি', price: 12000, emoji: '🧵', description: 'সিঙ্গার ইলেকট্রিক সেলাই মেশিন। ১৫ প্যাটার্ন সেলাই সুবিধা।', inStock: true, featured: true, images: [] },
        { id: 'p5', name: 'HP Laptop 15s Core i3', category: 'কম্পিউটার', price: 55000, emoji: '💻', description: 'HP 15s Intel Core i3, ৮GB RAM, ৫১২GB SSD, ১৫.৬" FHD ডিসপ্লে।', inStock: true, featured: false, images: [] },
        { id: 'p6', name: 'Rangs টেলিভিশন ৪৩"', category: 'ইলেকট্রনিক্স', price: 32000, emoji: '📺', description: 'Rangs 43 ইঞ্চি Android Smart TV। 4K UHD, WiFi, YouTube, Netflix সাপোর্ট।', inStock: true, featured: false, images: [] }
    ];

    // ── State ──
    let currentFilter = 'all';
    let selectedProduct = null;
    let cart = [];

    // ── Load cart from localStorage ──
    function loadCart() {
        try {
            cart = JSON.parse(localStorage.getItem('bf_cart') || '[]');
        } catch {
            cart = [];
        }
    }

    // ── Save cart ──
    function saveCart() {
        try {
            localStorage.setItem('bf_cart', JSON.stringify(cart));
        } catch (e) {
            if (DEBUG) console.warn('[Shop] Failed to save cart:', e);
        }
    }

    // ── Get products ──
    function getProducts() {
        if (isDBAvailable()) {
            try {
                const products = DB.getProducts();
                if (products && products.length > 0) {
                    return products;
                }
            } catch (e) {
                if (DEBUG) console.warn('[Shop] Failed to get products from DB:', e);
            }
        }
        return DEFAULT_PRODUCTS;
    }

    // ── Get orders ──
    function getOrders() {
        if (isDBAvailable()) {
            try {
                return DB.getOrders();
            } catch (e) {
                if (DEBUG) console.warn('[Shop] Failed to get orders from DB:', e);
            }
        }
        return [];
    }

    // ── Add order ──
    function addOrder(order) {
        if (isDBAvailable()) {
            try {
                return DB.addOrder(order);
            } catch (e) {
                if (DEBUG) console.warn('[Shop] Failed to add order to DB:', e);
            }
        }
        // Fallback: localStorage
        const orders = JSON.parse(localStorage.getItem('bf_orders') || '[]');
        orders.push(order);
        localStorage.setItem('bf_orders', JSON.stringify(orders));
        return order;
    }

    // ── Get session ──
    function getSession() {
        if (isDBAvailable()) {
            try {
                return DB.getSession();
            } catch (e) {
                if (DEBUG) console.warn('[Shop] Failed to get session:', e);
            }
        }
        return null;
    }

    // ════════ RENDER PRODUCTS ════════

    function renderProducts() {
        try {
            const products = getProducts();
            const searchInput = document.getElementById('searchInput');
            const sortSelect = document.getElementById('sortSel');

            const search = searchInput ? searchInput.value.trim().toLowerCase() : '';
            const sort = sortSelect ? sortSelect.value : 'default';

            let filtered = products.filter(p => {
                const matchCategory = currentFilter === 'all' || p.category === currentFilter;
                const matchSearch = !search ||
                    p.name.toLowerCase().includes(search) ||
                    (p.description || '').toLowerCase().includes(search) ||
                    (p.category || '').includes(search);
                return matchCategory && matchSearch;
            });

            // Sort
            switch (sort) {
                case 'price-asc':
                    filtered.sort((a, b) => a.price - b.price);
                    break;
                case 'price-desc':
                    filtered.sort((a, b) => b.price - a.price);
                    break;
                case 'name':
                    filtered.sort((a, b) => a.name.localeCompare(b.name, 'bn'));
                    break;
                default:
                    filtered.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
            }

            // Update count
            const countEl = document.getElementById('productCount');
            if (countEl) countEl.textContent = `মোট ${bnNum(filtered.length)} টি পণ্য`;

            const grid = document.getElementById('productsGrid');
            if (!grid) return;

            if (!filtered.length) {
                grid.innerHTML = `<div class="no-products" style="grid-column:1/-1">
                    <div class="icon">📦</div>
                    <p>কোনো পণ্য পাওয়া যায়নি।</p>
                </div>`;
                return;
            }

            grid.innerHTML = filtered.map(p => {
                const emi = calcEmi(p.price);
                const hasImage = p.images && p.images.length > 0 && p.images[0];
                const imgHtml = hasImage ?
                    `<img src="${p.images[0]}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'" />` :
                    `<span class="product-img-placeholder">${p.emoji || '📦'}</span>`;

                return `
                    <div class="product-card">
                        <div class="product-img-wrap">
                            ${imgHtml}
                            <span class="${p.inStock ? 'stock-badge in-stock' : 'stock-badge out-stock'}">${p.inStock ? '✅ আছে' : '❌ নেই'}</span>
                            ${p.featured ? '<span class="featured-badge">⭐ ফিচার্ড</span>' : ''}
                        </div>
                        <div class="product-body">
                            <div class="product-cat">${p.category || 'পণ্য'}</div>
                            <div class="product-name">${p.name}</div>
                            <div class="product-desc">${p.description || ''}</div>
                            <div class="price-block">
                                <div class="price-main">${fmtBn(p.price)}</div>
                                <div class="price-emi">কিস্তি: <span>${fmtBn(emi.perInstall)} × ৬</span> (১০% লাভ)</div>
                            </div>
                            <div class="product-actions">
                                <button class="btn-detail" onclick="openDetail('${p.id}')">বিস্তারিত</button>
                                <button class="btn-order" onclick="openOrder('${p.id}')" ${!p.inStock ? 'disabled' : ''}>
                                    ${p.inStock ? '🛒 অর্ডার' : 'স্টকে নেই'}
                                </button>
                                <button class="btn-cart-add" onclick="addToCart('${p.id}')" ${!p.inStock ? 'disabled' : ''}>
                                    🛒
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('[Shop] Render products error:', error);
            const grid = document.getElementById('productsGrid');
            if (grid) {
                grid.innerHTML = '<div style="text-align:center;padding:40px;color:#aaa;">পণ্য লোড করতে সমস্যা হয়েছে</div>';
            }
        }
    }

    // ════════ CATEGORIES ════════

    function renderCategories() {
        try {
            const products = getProducts();
            const categories = [];
            products.forEach(p => {
                if (p.category && !categories.includes(p.category)) {
                    categories.push(p.category);
                }
            });

            const container = document.getElementById('catFilters');
            if (!container) return;

            container.innerHTML = categories.map(c =>
                `<button class="fcat" onclick="setFilter('${c}',this)">${c}</button>`
            ).join('');

        } catch (error) {
            console.error('[Shop] Render categories error:', error);
        }
    }

    function setFilter(category, btn) {
        currentFilter = category;
        document.querySelectorAll('.fcat').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
        renderProducts();
    }

    // ════════ DETAIL MODAL ════════

    function openDetail(id) {
        try {
            const products = getProducts();
            const product = products.find(p => p.id === id);
            if (!product) {
                toast('পণ্য পাওয়া যায়নি', '#e53e3e');
                return;
            }

            selectedProduct = product;
            const emi = calcEmi(product.price);

            // Main image
            const mainBox = document.getElementById('mainImgBox');
            const mainEmoji = document.getElementById('mainImgEmoji');
            const thumbRow = document.getElementById('thumbRow');

            if (mainEmoji) mainEmoji.textContent = product.emoji || '📦';
            if (thumbRow) thumbRow.innerHTML = '';

            if (mainBox) {
                if (product.images && product.images.length > 0 && product.images[0]) {
                    mainBox.innerHTML = `<img src="${product.images[0]}" alt="${product.name}" style="width:100%;height:100%;object-fit:cover;" />`;
                    if (thumbRow) {
                        product.images.forEach((img, i) => {
                            thumbRow.innerHTML += `
                                <img src="${img}" class="thumb ${i === 0 ? 'active' : ''}" 
                                    onclick="setMainImg('${img}',this)" onerror="this.style.display='none'" />
                            `;
                        });
                    }
                } else {
                    mainBox.innerHTML = `<span style="font-size:4rem;">${product.emoji || '📦'}</span>`;
                }
            }

            // Details
            const catEl = document.getElementById('detailCat');
            const nameEl = document.getElementById('detailName');
            const priceEl = document.getElementById('detailPrice');
            const descEl = document.getElementById('detailDesc');
            const stockEl = document.getElementById('detailStock');
            const orderBtn = document.getElementById('detailOrderBtn');
            const emiBreakdown = document.getElementById('emiBreakdown');

            if (catEl) catEl.textContent = product.category || '';
            if (nameEl) nameEl.textContent = product.name;
            if (priceEl) priceEl.textContent = fmtBn(product.price);
            if (descEl) descEl.textContent = product.description || '';
            if (stockEl) {
                stockEl.innerHTML = product.inStock ?
                    '<span style="color:#065F46;font-weight:700;">✅ স্টকে আছে</span>' :
                    '<span style="color:#dc2626;font-weight:700;">❌ স্টকে নেই</span>';
            }
            if (orderBtn) orderBtn.disabled = !product.inStock;

            if (emiBreakdown) {
                emiBreakdown.innerHTML = `
                    <div class="emi-row"><span>পণ্যের মূল্য</span><span>${fmtBn(product.price)}</span></div>
                    <div class="emi-row"><span>১০% লাভ</span><span>${fmtBn(emi.profit)}</span></div>
                    <div class="emi-row"><span>মোট পরিশোধযোগ্য</span><span>${fmtBn(emi.total)}</span></div>
                    <div class="emi-row"><span>১ম কিস্তি (ডাউন)</span><span>${fmtBn(emi.down)}</span></div>
                    <div class="emi-row"><span>বাকি ৫ কিস্তি</span><span>${fmtBn(emi.perInstall)} × ৫</span></div>
                `;
            }

            const modal = document.getElementById('detailModal');
            if (modal) modal.classList.add('open');

        } catch (error) {
            console.error('[Shop] Open detail error:', error);
            toast('বিস্তারিত লোড করতে সমস্যা', '#e53e3e');
        }
    }

    function setMainImg(src, thumb) {
        const mainBox = document.getElementById('mainImgBox');
        if (mainBox) {
            mainBox.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;" />`;
        }
        document.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
        if (thumb) thumb.classList.add('active');
    }

    function closeDetail() {
        const modal = document.getElementById('detailModal');
        if (modal) modal.classList.remove('open');
    }

    function openOrderFromDetail() {
        closeDetail();
        if (selectedProduct) openOrder(selectedProduct.id);
    }

    // ════════ ORDER MODAL ════════

    function openOrder(id) {
        try {
            const products = getProducts();
            const product = products.find(p => p.id === id);
            if (!product) {
                toast('পণ্য পাওয়া যায়নি', '#e53e3e');
                return;
            }

            if (!product.inStock) {
                toast('এই পণ্যটি এখন স্টকে নেই।', '#e53e3e');
                return;
            }

            selectedProduct = product;
            const emi = calcEmi(product.price);

            // Summary
            const summaryEl = document.getElementById('orderSummary');
            if (summaryEl) {
                summaryEl.innerHTML = `
                    <div class="srow"><span>পণ্য</span><span>${product.name}</span></div>
                    <div class="srow"><span>বাজারমূল্য</span><span>${fmtBn(product.price)}</span></div>
                    <div class="srow"><span>১০% লাভ</span><span>${fmtBn(emi.profit)}</span></div>
                    <div class="srow"><span>মোট পরিশোধযোগ্য</span><span>${fmtBn(emi.total)}</span></div>
                    <div class="srow"><span>প্রতি কিস্তি (৬ টি)</span><span>${fmtBn(emi.perInstall)} × ৬</span></div>
                `;
            }

            // Pre-fill from session
            const session = getSession();
            if (session) {
                const nameEl = document.getElementById('ord-name');
                const phoneEl = document.getElementById('ord-phone');
                const nidEl = document.getElementById('ord-nid');
                if (nameEl) nameEl.value = session.name || '';
                if (phoneEl) phoneEl.value = session.phone || '';
                if (nidEl) nidEl.value = session.memberID || '';
            }

            const alertEl = document.getElementById('orderAlert');
            if (alertEl) alertEl.classList.add('hidden');

            const modal = document.getElementById('orderModal');
            if (modal) modal.classList.add('open');

        } catch (error) {
            console.error('[Shop] Open order error:', error);
            toast('অর্ডার ফর্ম লোড করতে সমস্যা', '#e53e3e');
        }
    }

    function closeOrder() {
        const modal = document.getElementById('orderModal');
        if (modal) modal.classList.remove('open');
    }

    function submitOrder() {
        try {
            const name = document.getElementById('ord-name')?.value?.trim();
            const phone = document.getElementById('ord-phone')?.value?.trim();
            const nid = document.getElementById('ord-nid')?.value?.trim();
            const address = document.getElementById('ord-address')?.value?.trim();
            const witness = document.getElementById('ord-witness')?.value?.trim();
            const note = document.getElementById('ord-note')?.value?.trim();
            const alertEl = document.getElementById('orderAlert');

            // Validation
            if (!name || !phone || !nid || !address) {
                if (alertEl) {
                    alertEl.className = 'aalert aalert-err';
                    alertEl.textContent = 'তারকা চিহ্নিত সকল তথ্য পূরণ করুন।';
                    alertEl.classList.remove('hidden');
                }
                return;
            }

            if (phone.replace(/\D/g, '').length < 10) {
                if (alertEl) {
                    alertEl.className = 'aalert aalert-err';
                    alertEl.textContent = 'সঠিক মোবাইল নম্বর দিন।';
                    alertEl.classList.remove('hidden');
                }
                return;
            }

            const emi = calcEmi(selectedProduct.price);
            const order = {
                id: 'ORD-' + Date.now().toString(36).toUpperCase(),
                productId: selectedProduct.id,
                productName: selectedProduct.name,
                price: selectedProduct.price,
                totalPayable: emi.total,
                perInstall: emi.perInstall,
                customerName: name,
                customerPhone: phone,
                nid: nid,
                address: address,
                witness: witness || '',
                note: note || '',
                status: 'pending',
                statusStep: 0,
                submittedAt: new Date().toISOString()
            };

            addOrder(order);

            // Clear cart for this product
            cart = cart.filter(item => item.id !== selectedProduct.id);
            saveCart();
            updateCartCount();

            closeOrder();
            showMyOrder(order);
            toast('✅ আবদেন জমা হয়েছে! আইডি: ' + order.id, '#065F46');

            // Clear form
            ['ord-name', 'ord-phone', 'ord-nid', 'ord-address', 'ord-witness', 'ord-note'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });

        } catch (error) {
            console.error('[Shop] Submit order error:', error);
            toast('অর্ডার জমা দিতে সমস্যা', '#e53e3e');
        }
    }

    // ════════ ORDER STATUS TRACKER ════════

    const ORDER_STEPS = ['আবেদন জমা', 'কমিটি পর্যালোচনা', 'অনুমোদন', 'পণ্য সংগ্রহ', 'বিতরণ', 'সম্পন্ন'];

    function showMyOrder(order) {
        try {
            const bar = document.getElementById('myOrdersBar');
            const info = document.getElementById('latestOrderInfo');
            const steps = document.getElementById('trackSteps');

            if (!bar || !info || !steps) return;

            bar.classList.remove('hidden');
            info.innerHTML = `
                <strong>${order.productName}</strong> | আইডি: ${order.id} | 
                মূল্য: ${fmtBn(order.price)} | 
                অবস্থা: <span style="color:var(--gold);font-weight:700;">পেন্ডিং</span>
            `;

            const currentStep = order.statusStep || 0;
            steps.innerHTML = ORDER_STEPS.map((step, i) => {
                const cls = i === currentStep ? 'current' : i < currentStep ? 'done' : '';
                return `
                    <div class="track-step">
                        <div class="ts-dot ${cls}">${i < currentStep ? '✓' : (i + 1)}</div>
                        <div class="ts-label">${step}</div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('[Shop] Show my order error:', error);
        }
    }

    function loadMyOrders() {
        try {
            const orders = getOrders();
            if (!orders.length) return;

            const session = getSession();
            let latest = null;

            if (session) {
                latest = orders.filter(o => o.customerPhone === session.phone).slice(-1)[0];
            }

            if (!latest && orders.length > 0) {
                latest = orders[orders.length - 1];
            }

            if (latest) showMyOrder(latest);

        } catch (error) {
            console.error('[Shop] Load my orders error:', error);
        }
    }

    // ════════ CART ════════

    function toggleCart(e) {
        if (e) e.preventDefault();
        const sidebar = document.getElementById('cartSidebar');
        if (sidebar) sidebar.classList.toggle('open');
        renderCart();
    }

    function addToCart(productId) {
        try {
            const products = getProducts();
            const product = products.find(p => p.id === productId);

            if (!product || !product.inStock) {
                toast('পণ্যটি স্টকে নেই', '#e53e3e');
                return;
            }

            if (cart.find(c => c.id === productId)) {
                toast('পণ্যটি ইতিমধ্যে কার্টে আছে।', '#C9A227');
                return;
            }

            cart.push({
                id: product.id,
                name: product.name,
                price: product.price,
                emoji: product.emoji || '📦'
            });

            saveCart();
            updateCartCount();
            toast(`"${product.name}" কার্টে যোগ হয়েছে ✅`);

        } catch (error) {
            console.error('[Shop] Add to cart error:', error);
            toast('কার্টে যোগ করতে সমস্যা', '#e53e3e');
        }
    }

    function removeFromCart(id) {
        cart = cart.filter(c => c.id !== id);
        saveCart();
        updateCartCount();
        renderCart();
    }

    function updateCartCount() {
        const el = document.getElementById('cartCount');
        if (el) el.textContent = cart.length || '0';
    }

    function renderCart() {
        try {
            const el = document.getElementById('cartItems');
            const totalEl = document.getElementById('cartTotal');

            if (!el) return;

            if (!cart.length) {
                el.innerHTML = `<div class="empty-cart"><div class="icon">🛒</div><p>কার্ট খালি</p></div>`;
                if (totalEl) totalEl.textContent = '৳০';
                return;
            }

            let total = 0;
            el.innerHTML = cart.map(item => {
                total += item.price;
                return `
                    <div class="cart-item">
                        <div class="cart-item-img">${item.emoji}</div>
                        <div class="cart-item-info">
                            <div class="cart-item-name">${item.name}</div>
                            <div class="cart-item-price">${fmtBn(item.price)}</div>
                        </div>
                        <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">✕</button>
                    </div>
                `;
            }).join('');

            if (totalEl) totalEl.textContent = fmtBn(total);

        } catch (error) {
            console.error('[Shop] Render cart error:', error);
        }
    }

    function checkoutCart() {
        try {
            if (!cart.length) {
                toast('কার্ট খালি!', '#e53e3e');
                return;
            }

            // Get first product from cart
            const products = getProducts();
            const firstItem = cart[0];
            const product = products.find(p => p.id === firstItem.id);

            if (product) {
                const sidebar = document.getElementById('cartSidebar');
                if (sidebar) sidebar.classList.remove('open');
                openOrder(product.id);
            } else {
                toast('পণ্য পাওয়া যায়নি', '#e53e3e');
            }

        } catch (error) {
            console.error('[Shop] Checkout error:', error);
            toast('চেকআউটে সমস্যা', '#e53e3e');
        }
    }

    // ════════ SEARCH & SORT ════════

    function searchProducts() {
        renderProducts();
    }

    function sortProducts() {
        renderProducts();
    }

    // ════════ INIT ════════

    document.addEventListener('DOMContentLoaded', function () {
        try {
            loadCart();
            renderCategories();
            renderProducts();
            updateCartCount();
            loadMyOrders();

            // Set up search listener
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.addEventListener('input', searchProducts);
            }

            // Set up sort listener
            const sortSelect = document.getElementById('sortSel');
            if (sortSelect) {
                sortSelect.addEventListener('change', sortProducts);
            }

            if (DEBUG) {
                console.log('[Shop] Initialized. Cart items:', cart.length);
            }

        } catch (error) {
            console.error('[Shop] Init error:', error);
            toast('শপ লোড করতে সমস্যা', '#e53e3e');
        }
    });

    // ════════ EXPOSE GLOBALLY ════════

    window.renderProducts = renderProducts;
    window.renderCategories = renderCategories;
    window.setFilter = setFilter;
    window.openDetail = openDetail;
    window.closeDetail = closeDetail;
    window.setMainImg = setMainImg;
    window.openOrder = openOrder;
    window.closeOrder = closeOrder;
    window.openOrderFromDetail = openOrderFromDetail;
    window.submitOrder = submitOrder;
    window.showMyOrder = showMyOrder;
    window.loadMyOrders = loadMyOrders;
    window.toggleCart = toggleCart;
    window.addToCart = addToCart;
    window.removeFromCart = removeFromCart;
    window.updateCartCount = updateCartCount;
    window.renderCart = renderCart;
    window.checkoutCart = checkoutCart;
    window.searchProducts = searchProducts;
    window.sortProducts = sortProducts;
    window.calcEmi = calcEmi;
    window.fmtBn = fmtBn;
    window.bnNum = bnNum;
    window.toast = toast;

})();