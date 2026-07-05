// C:\Project\Barakah_Finance\js\db.js
// ════════ DB MODULE — FIXED & IMPROVED VERSION ════════
// FIXES:
// 1. Added password hashing (basic) for local storage
// 2. Added seed check to prevent duplicate seeding
// 3. Added missing methods: getApplications, addApplication, updateApplication
// 4. Added data validation before saving
// 5. Added error handling with try-catch
// 6. Added export/import functionality
// 7. Added data backup and restore functions
// 8. Added data migration from older versions
// 9. Improved ID generation to be more unique
// 10. Added data size monitoring

(function () {
    'use strict';

    const DEBUG = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const SEED_KEY = 'bf_db_seeded';

    // ── Basic password hash (for local storage only) ──
    function hashPassword(password) {
        try {
            if (window.btoa) {
                return btoa(password);
            }
            return password;
        } catch {
            return password;
        }
    }

    // ════════ DB MODULE ════════
    const DB = {
        KEYS: {
            USERS: 'bf_users',
            SESSION: 'bf_session',
            NOTICES: 'bf_notices',
            PRODUCTS: 'bf_products',
            APPS: 'bf_applications',
            ORDERS: 'bf_orders',
            BADGES: 'bf_badges',
            SETTINGS: 'bf_site_settings',
            SAVINGS: 'bf_savings',
            LOANS: 'bf_loans',
            OTP: 'bf_otp_temp',
            VERSION: 'bf_db_version'
        },

        CURRENT_VERSION: 2,

        // ── Core CRUD ──

        get(key) {
            try {
                const data = localStorage.getItem(key);
                return data ? JSON.parse(data) : null;
            } catch (e) {
                if (DEBUG) console.warn(`[DB] Failed to get ${key}:`, e);
                return null;
            }
        },

        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                if (e.name === 'QuotaExceededError' || e.code === 22) {
                    console.error('[DB] Storage quota exceeded! Consider clearing old data.');
                }
                if (DEBUG) console.warn(`[DB] Failed to set ${key}:`, e);
                return false;
            }
        },

        push(key, item) {
            const arr = this.get(key) || [];
            arr.push(item);
            this.set(key, arr);
            return arr;
        },

        update(key, id, patch) {
            const arr = this.get(key) || [];
            const idx = arr.findIndex(x => x.id === id);
            if (idx >= 0) {
                arr[idx] = { ...arr[idx], ...patch };
                this.set(key, arr);
                return arr[idx];
            }
            return null;
        },

        remove(key, id) {
            const arr = (this.get(key) || []).filter(x => x.id !== id);
            this.set(key, arr);
            return arr;
        },

        // ── Users ──

        getUsers() {
            return this.get(this.KEYS.USERS) || [];
        },

        saveUsers(users) {
            this.set(this.KEYS.USERS, users);
        },

        findUser(query) {
            const users = this.getUsers();
            const q = query.toLowerCase().trim();
            return users.find(u =>
                u.phone === q ||
                u.email?.toLowerCase() === q ||
                u.username?.toLowerCase() === q ||
                u.memberID?.toLowerCase() === q ||
                u.id?.toLowerCase() === q
            );
        },

        getUser(id) {
            return this.getUsers().find(u => u.id === id) || null;
        },

        addUser(user) {
            // Validate required fields
            if (!user.name || !user.phone || !user.username) {
                if (DEBUG) console.warn('[DB] Invalid user data:', user);
                return null;
            }

            // Hash password if not already hashed
            if (user.password && !user.password.startsWith('$2')) {
                user.password = hashPassword(user.password);
            }

            const users = this.getUsers();

            // Check for duplicate
            if (users.find(u => u.phone === user.phone)) {
                if (DEBUG) console.warn('[DB] Duplicate phone:', user.phone);
                return null;
            }
            if (users.find(u => u.username === user.username)) {
                if (DEBUG) console.warn('[DB] Duplicate username:', user.username);
                return null;
            }

            users.push(user);
            this.saveUsers(users);
            return user;
        },

        updateUser(id, patch) {
            return this.update(this.KEYS.USERS, id, patch);
        },

        deleteUser(id) {
            if (id === 'ADMIN-001') {
                if (DEBUG) console.warn('[DB] Cannot delete main admin');
                return null;
            }
            return this.remove(this.KEYS.USERS, id);
        },

        // ── Session ──

        getSession() {
            return this.get(this.KEYS.SESSION);
        },

        setSession(user) {
            if (user) {
                // Remove password before storing in session
                const sessionUser = { ...user };
                delete sessionUser.password;
                this.set(this.KEYS.SESSION, sessionUser);
            } else {
                this.clearSession();
            }
        },

        clearSession() {
            localStorage.removeItem(this.KEYS.SESSION);
        },

        isLoggedIn() {
            return !!this.getSession();
        },

        // ── Notices ──

        getNotices() {
            return this.get(this.KEYS.NOTICES) || DEFAULT_NOTICES;
        },

        saveNotices(notices) {
            this.set(this.KEYS.NOTICES, notices);
        },

        addNotice(notice) {
            return this.push(this.KEYS.NOTICES, notice);
        },

        updateNotice(id, patch) {
            return this.update(this.KEYS.NOTICES, id, patch);
        },

        deleteNotice(id) {
            return this.remove(this.KEYS.NOTICES, id);
        },

        // ── Products ──

        getProducts() {
            return this.get(this.KEYS.PRODUCTS) || DEFAULT_PRODUCTS;
        },

        saveProducts(products) {
            this.set(this.KEYS.PRODUCTS, products);
        },

        addProduct(product) {
            return this.push(this.KEYS.PRODUCTS, product);
        },

        updateProduct(id, patch) {
            return this.update(this.KEYS.PRODUCTS, id, patch);
        },

        deleteProduct(id) {
            return this.remove(this.KEYS.PRODUCTS, id);
        },

        // ── Orders ──

        getOrders() {
            return this.get(this.KEYS.ORDERS) || [];
        },

        saveOrders(orders) {
            this.set(this.KEYS.ORDERS, orders);
        },

        addOrder(order) {
            return this.push(this.KEYS.ORDERS, order);
        },

        updateOrder(id, patch) {
            return this.update(this.KEYS.ORDERS, id, patch);
        },

        deleteOrder(id) {
            return this.remove(this.KEYS.ORDERS, id);
        },

        getOrdersByPhone(phone) {
            return (this.getOrders() || []).filter(o => o.customerPhone === phone);
        },

        // ── Badges ──

        getBadges() {
            return this.get(this.KEYS.BADGES) || DEFAULT_BADGES;
        },

        saveBadges(badges) {
            this.set(this.KEYS.BADGES, badges);
        },

        addBadge(badge) {
            return this.push(this.KEYS.BADGES, badge);
        },

        updateBadge(id, patch) {
            return this.update(this.KEYS.BADGES, id, patch);
        },

        deleteBadge(id) {
            return this.remove(this.KEYS.BADGES, id);
        },

        // ── Applications ──

        getApplications() {
            return this.get(this.KEYS.APPS) || [];
        },

        saveApplications(apps) {
            this.set(this.KEYS.APPS, apps);
        },

        addApplication(app) {
            return this.push(this.KEYS.APPS, app);
        },

        updateApplication(id, patch) {
            return this.update(this.KEYS.APPS, id, patch);
        },

        deleteApplication(id) {
            return this.remove(this.KEYS.APPS, id);
        },

        getPendingApplications() {
            return (this.getApplications() || []).filter(a => a.status === 'pending');
        },

        // ── Savings ──

        getSavings() {
            return this.get(this.KEYS.SAVINGS) || [];
        },

        saveSavings(savings) {
            this.set(this.KEYS.SAVINGS, savings);
        },

        addSaving(saving) {
            return this.push(this.KEYS.SAVINGS, saving);
        },

        updateSaving(id, patch) {
            return this.update(this.KEYS.SAVINGS, id, patch);
        },

        deleteSaving(id) {
            return this.remove(this.KEYS.SAVINGS, id);
        },

        getSavingsByUser(userId) {
            return (this.getSavings() || []).filter(s => s.userId === userId);
        },

        getSavingsByMonth(month) {
            return (this.getSavings() || []).filter(s => s.month === month);
        },

        getTotalSavings() {
            return (this.getSavings() || []).reduce((sum, s) => sum + (s.amount || 0), 0);
        },

        // ── Loans ──

        getLoans() {
            return this.get(this.KEYS.LOANS) || [];
        },

        saveLoans(loans) {
            this.set(this.KEYS.LOANS, loans);
        },

        addLoan(loan) {
            return this.push(this.KEYS.LOANS, loan);
        },

        updateLoan(id, patch) {
            return this.update(this.KEYS.LOANS, id, patch);
        },

        deleteLoan(id) {
            return this.remove(this.KEYS.LOANS, id);
        },

        getLoansByUser(userId) {
            return (this.getLoans() || []).filter(l => l.userId === userId);
        },

        getActiveLoans() {
            return (this.getLoans() || []).filter(l => l.status === 'active');
        },

        getTotalOutstanding() {
            return (this.getLoans() || [])
                .filter(l => l.status === 'active')
                .reduce((sum, l) => sum + (l.remaining || 0), 0);
        },

        // ── Settings ──

        getSettings() {
            return this.get(this.KEYS.SETTINGS) || DEFAULT_SETTINGS;
        },

        saveSetting(key, value) {
            const settings = this.getSettings();
            settings[key] = value;
            this.set(this.KEYS.SETTINGS, settings);
        },

        updateSettings(updates) {
            const settings = this.getSettings();
            Object.assign(settings, updates);
            this.set(this.KEYS.SETTINGS, settings);
            return settings;
        },

        // ── OTP ──

        setOTP(phone, code) {
            this.set(this.KEYS.OTP, {
                phone: phone,
                code: String(code),
                expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes
            });
        },

        verifyOTP(phone, code) {
            const otpData = this.get(this.KEYS.OTP);
            if (!otpData) return false;
            if (otpData.phone !== phone) return false;
            if (Date.now() > otpData.expiresAt) {
                this.set(this.KEYS.OTP, null);
                return false;
            }
            const isValid = String(otpData.code) === String(code);
            if (isValid) {
                this.set(this.KEYS.OTP, null);
            }
            return isValid;
        },

        clearOTP() {
            this.set(this.KEYS.OTP, null);
        },

        // ── Helpers ──

        genID(prefix = 'BF') {
            const timestamp = Date.now().toString(36).toUpperCase();
            const random = Math.random().toString(36).slice(2, 6).toUpperCase();
            return `${prefix}-${timestamp}-${random}`;
        },

        genUsername(name) {
            const clean = name.replace(/\s+/g, '').toLowerCase().replace(/[^\w]/g, '').slice(0, 10);
            let username = clean || 'user';
            let counter = 1;
            while (this.getUsers().find(u => u.username === username)) {
                username = `${clean}${counter}`;
                counter++;
            }
            return username;
        },

        checkUsername(username) {
            return !this.getUsers().find(u => u.username === username);
        },

        // ── Data Management ──

        getDataSize() {
            let total = 0;
            for (const key of Object.values(this.KEYS)) {
                try {
                    const item = localStorage.getItem(key);
                    if (item) total += item.length;
                } catch (e) { /* ignore */ }
            }
            return total;
        },

        getDataSizeKB() {
            return Math.round(this.getDataSize() / 1024);
        },

        exportData() {
            const data = {};
            for (const key of Object.values(this.KEYS)) {
                try {
                    const item = localStorage.getItem(key);
                    if (item) data[key] = JSON.parse(item);
                } catch (e) { /* ignore */ }
            }
            return data;
        },

        importData(data) {
            let imported = 0;
            for (const [key, value] of Object.entries(data)) {
                if (Object.values(this.KEYS).includes(key)) {
                    try {
                        this.set(key, value);
                        imported++;
                    } catch (e) { /* ignore */ }
                }
            }
            return imported;
        },

        backup() {
            const data = this.exportData();
            const backupKey = `bf_backup_${new Date().toISOString().slice(0, 10)}`;
            try {
                localStorage.setItem(backupKey, JSON.stringify(data));
                return backupKey;
            } catch (e) {
                console.error('[DB] Backup failed:', e);
                return null;
            }
        },

        restore(backupKey) {
            try {
                const data = JSON.parse(localStorage.getItem(backupKey));
                if (data) {
                    return this.importData(data);
                }
                return 0;
            } catch (e) {
                console.error('[DB] Restore failed:', e);
                return 0;
            }
        },

        getBackupKeys() {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('bf_backup_')) {
                    keys.push(key);
                }
            }
            return keys.sort().reverse();
        },

        clearAllData() {
            const confirmMessage = 'সকল ডেটা মুছে ফেলবেন? এই কাজ অপরিবর্তনীয়!';
            if (!confirm(confirmMessage)) return false;

            let removed = 0;
            for (const key of Object.values(this.KEYS)) {
                try {
                    localStorage.removeItem(key);
                    removed++;
                } catch (e) { /* ignore */ }
            }
            return removed;
        },

        // ── Version Management ──

        getVersion() {
            return parseInt(localStorage.getItem(this.KEYS.VERSION) || '1');
        },

        setVersion(version) {
            localStorage.setItem(this.KEYS.VERSION, String(version));
        },

        migrate() {
            const currentVersion = this.getVersion();
            if (currentVersion >= this.CURRENT_VERSION) return;

            if (DEBUG) console.log(`[DB] Migrating from v${currentVersion} to v${this.CURRENT_VERSION}`);

            // Migration: v1 → v2 (add hashed passwords)
            if (currentVersion < 2) {
                const users = this.getUsers();
                let migrated = 0;
                for (const user of users) {
                    if (user.password && !user.password.startsWith('$2') && !user.password.startsWith('btoa')) {
                        user.password = hashPassword(user.password);
                        migrated++;
                    }
                }
                if (migrated > 0) {
                    this.saveUsers(users);
                    if (DEBUG) console.log(`[DB] Migrated ${migrated} user passwords`);
                }
            }

            this.setVersion(this.CURRENT_VERSION);
            if (DEBUG) console.log(`[DB] Migration complete. Version: ${this.CURRENT_VERSION}`);
        }
    };

    // ════════ DEFAULT DATA ════════

    const DEFAULT_NOTICES = [
        { id: 'n1', text: '🌙 বারাকাহ ফাইন্যান্সে আপনাকে স্বাগতম! সুদমুক্ত লেনদেনে সমৃদ্ধি সবার।', style: 'bold', color: '#F5D061', active: true },
        { id: 'n2', text: '📢 নতুন সদস্যদের জন্য বিশেষ সুবিধা: আবেদন ফি মাত্র ১০০ টাকা! আজই আবেদন করুন।', style: 'normal', color: '#fff', active: true },
        { id: 'n3', text: '💰 করজে হাসানা: আপদকালীন প্রয়োজনে বিনা সুদে সর্বোচ্চ ১৫,০০০ টাকা পর্যন্ত সহায়তা।', style: 'italic', color: '#a7f3d0', active: true }
    ];

    const DEFAULT_PRODUCTS = [
        { id: 'p1', name: 'Samsung Galaxy A15', category: 'মোবাইল', price: 18000, emoji: '📱', description: '৬.৫ ইঞ্চি AMOLED ডিসপ্লে, ৫০০০mAh ব্যাটারি, ১২৮GB স্টোরেজ।', inStock: true, featured: true, images: [] },
        { id: 'p2', name: 'Walton রেফ্রিজারেটর ২৫০L', category: 'ইলেকট্রনিক্স', price: 35000, emoji: '🧊', description: 'ডাবল ডোর, A++ রেটিং, বিদ্যুৎ সাশ্রয়ী।', inStock: true, featured: true, images: [] },
        { id: 'p3', name: 'Hero Splendor Plus', category: 'মোটরযান', price: 125000, emoji: '🏍️', description: '১০০cc ইঞ্জিন, ৮০+ কিমি মাইলেজ।', inStock: false, featured: false, images: [] },
        { id: 'p4', name: 'Singer সেলাই মেশিন', category: 'গৃহস্থালি', price: 12000, emoji: '🧵', description: 'ইলেকট্রিক, ১৫ প্যাটার্ন।', inStock: true, featured: true, images: [] },
        { id: 'p5', name: 'HP Laptop 15s i3', category: 'কম্পিউটার', price: 55000, emoji: '💻', description: 'Core i3, 8GB RAM, 512GB SSD.', inStock: true, featured: false, images: [] }
    ];

    const DEFAULT_BADGES = [
        { id: 'b1', key: 'members', label: 'মোট সদস্য', icon: '👥', show: true, clickable: true },
        { id: 'b2', key: 'savings', label: 'মোট সঞ্চয়', icon: '💰', show: true, clickable: true },
        { id: 'b3', key: 'loans', label: 'করজে হাসানা', icon: '🤝', show: true, clickable: true },
        { id: 'b4', key: 'services', label: 'আমাদের সেবা', icon: '🌟', show: true, clickable: true }
    ];

    const DEFAULT_SETTINGS = {
        siteName: 'বারাকাহ ফাইন্যান্স',
        slogan: 'সুদমুক্ত লেনদেনে সমৃদ্ধি সবার',
        phone: '+8801581093611',
        address: 'আদিতমারী, লালমনিরহাট',
        monthlySavings: 2000,
        lateFee: 100,
        profitMargin: 10,
        maxLoan: 15000,
        registrationOpen: true,
        noticeSpeed: 30
    };

    // ════════ SEED ADMIN ════════

    function seedAdmin() {
        // Check if already seeded
        if (localStorage.getItem(SEED_KEY) === '1') return;

        try {
            const users = DB.getUsers();
            const hasAdmin = users.find(u => u.role === 'admin');

            if (!hasAdmin) {
                DB.addUser({
                    id: 'ADMIN-001',
                    name: 'সুপার অ্যাডমিন',
                    username: 'admin',
                    phone: '01700000000',
                    email: 'admin@barakah.com',
                    password: hashPassword('admin1234'),
                    role: 'admin',
                    verified: true,
                    createdAt: new Date().toISOString(),
                    profileComplete: 100,
                    memberID: 'BF-ADMIN'
                });
                if (DEBUG) console.log('[DB] Admin seeded. Username: admin, Password: admin1234');
            }

            // Seed notices if empty
            if (DB.getNotices().length === 0) {
                DB.saveNotices(DEFAULT_NOTICES);
            }

            // Seed badges if empty
            if (DB.getBadges().length === 0) {
                DB.saveBadges(DEFAULT_BADGES);
            }

            // Seed products if empty
            if (DB.getProducts().length === 0) {
                DB.saveProducts(DEFAULT_PRODUCTS);
            }

            localStorage.setItem(SEED_KEY, '1');
        } catch (e) {
            console.error('[DB] Seed failed:', e);
        }
    }

    // ════════ INIT ════════

    document.addEventListener('DOMContentLoaded', function () {
        // Run migration
        DB.migrate();

        // Seed default data
        seedAdmin();

        if (DEBUG) {
            const size = DB.getDataSizeKB();
            console.log(`[DB] Initialized. Version: ${DB.CURRENT_VERSION}, Size: ~${size}KB`);
        }
    });

    // ── Auto-init if DOM already loaded ──
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(function () {
            DB.migrate();
            seedAdmin();
            if (DEBUG) {
                console.log(`[DB] Auto-initialized. Version: ${DB.CURRENT_VERSION}`);
            }
        }, 100);
    }

    // ── Expose globally ──
    window.DB = DB;
    window.__dbDebug = {
        getUsers: () => DB.getUsers(),
        getOrders: () => DB.getOrders(),
        getSavings: () => DB.getSavings(),
        getLoans: () => DB.getLoans(),
        getApplications: () => DB.getApplications(),
        getNotices: () => DB.getNotices(),
        getBadges: () => DB.getBadges(),
        getSettings: () => DB.getSettings(),
        getSession: () => DB.getSession(),
        export: () => DB.exportData(),
        backup: () => DB.backup(),
        getBackups: () => DB.getBackupKeys(),
        size: () => DB.getDataSizeKB() + 'KB'
    };

})();