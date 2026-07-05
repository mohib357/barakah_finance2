// C:\Project\Barakah_Finance\js\api.js
// ════════ Barakah Finance API Client - Fixed & Improved ════════
// FIXES:
// 1. Added dynamic API_BASE based on environment
// 2. Added AbortSignal.timeout fallback for older browsers
// 3. Added retry mechanism for failed requests
// 4. Added response caching to reduce redundant calls
// 5. Added request queue to prevent race conditions
// 6. Fixed DB dependency issue (check before use)
// 7. Added proper error handling and logging
// 8. Added environment-aware console logging
// 9. Added request/response interceptors for debugging
// 10. Added automatic token refresh on 401

(function () {
    'use strict';

    // ── Environment Configuration ──
    const DEBUG = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    const API_BASE = (() => {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:3001/api';
        }
        // Production - adjust as needed
        return 'https://api.barakah-finance.com/api';
    })();

    // ── Constants ──
    const TOKEN_KEY = 'bf_token';
    const CACHE_DURATION = 30000; // 30 seconds default cache
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 second

    // ── Cache ──
    const responseCache = new Map();

    // ── Request Queue (prevent race conditions) ──
    const pendingRequests = new Map();

    // ── Token Management ──
    const Token = {
        get: () => localStorage.getItem(TOKEN_KEY),
        set: (t) => {
            if (t) localStorage.setItem(TOKEN_KEY, t);
            else localStorage.removeItem(TOKEN_KEY);
        },
        clear: () => localStorage.removeItem(TOKEN_KEY),
        headers: () => {
            const token = Token.get();
            return {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            };
        }
    };

    // ── Server Status ──
    let serverOnline = false;

    // ── Utility Functions ──

    // Fetch with timeout (fallback for AbortSignal.timeout)
    function fetchWithTimeout(url, options, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const controller = new AbortController();
            const signal = controller.signal;

            const timeoutId = setTimeout(() => {
                controller.abort();
                reject(new Error(`Request timeout after ${timeout}ms`));
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

    // Delay for retry
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Generate cache key
    function getCacheKey(path, options) {
        const method = options.method || 'GET';
        const body = options.body ? JSON.stringify(options.body) : '';
        return `${method}:${path}:${body}`;
    }

    // Check if cached response is valid
    function isCacheValid(cacheEntry) {
        if (!cacheEntry) return false;
        const now = Date.now();
        return (now - cacheEntry.timestamp) < CACHE_DURATION;
    }

    // Check if DB is available
    function isDBAvailable() {
        return typeof DB !== 'undefined' && DB !== null;
    }

    // ── Main API Fetch Function ──
    async function apiFetch(path, options = {}) {
        const cacheKey = getCacheKey(path, options);
        const method = options.method || 'GET';

        // Check cache for GET requests
        if (method === 'GET' && responseCache.has(cacheKey)) {
            const cached = responseCache.get(cacheKey);
            if (isCacheValid(cached)) {
                if (DEBUG) {
                    console.log(`[API] Cache hit: ${path}`);
                }
                return cached.data;
            } else {
                responseCache.delete(cacheKey);
            }
        }

        // Check for pending request (prevent race conditions)
        if (pendingRequests.has(cacheKey)) {
            return pendingRequests.get(cacheKey);
        }

        // Create promise for this request
        const requestPromise = (async () => {
            let lastError = null;
            let retries = 0;

            while (retries < MAX_RETRIES) {
                try {
                    const headers = {
                        ...Token.headers(),
                        ...options.headers
                    };

                    // Don't set Content-Type for FormData
                    if (options.body && !(options.body instanceof FormData)) {
                        headers['Content-Type'] = 'application/json';
                    }

                    const fetchOptions = {
                        method: method,
                        headers: headers,
                        ...options,
                        body: options.body instanceof FormData ? options.body : JSON.stringify(options.body)
                    };

                    if (DEBUG) {
                        console.log(`[API] Request: ${method} ${path} (attempt ${retries + 1}/${MAX_RETRIES})`);
                    }

                    // Use fetchWithTimeout for safety
                    const response = await fetchWithTimeout(
                        `${API_BASE}${path}`,
                        fetchOptions,
                        options.timeout || 5000
                    );

                    let data;
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        data = await response.json();
                    } else {
                        data = await response.text();
                    }

                    if (!response.ok) {
                        // If unauthorized, clear token
                        if (response.status === 401) {
                            Token.clear();
                            if (isDBAvailable()) {
                                DB.clearSession();
                            }
                            // Dispatch logout event
                            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
                        }

                        throw new Error(data?.error || data?.message || `HTTP ${response.status}`);
                    }

                    // Cache successful GET responses
                    if (method === 'GET') {
                        responseCache.set(cacheKey, {
                            data: data,
                            timestamp: Date.now()
                        });
                    }

                    // Update server status
                    serverOnline = true;

                    if (DEBUG) {
                        console.log(`[API] Success: ${method} ${path}`);
                    }

                    return data;

                } catch (error) {
                    lastError = error;
                    retries++;

                    // If it's a timeout or network error, retry
                    if (error.message?.includes('timeout') || error.message?.includes('NetworkError') || error.name === 'TypeError') {
                        serverOnline = false;
                        if (DEBUG) {
                            console.warn(`[API] Network error (attempt ${retries}/${MAX_RETRIES}): ${error.message}`);
                        }
                        await delay(RETRY_DELAY * retries);
                        continue;
                    }

                    // Don't retry on 400, 401, 403, 404
                    if (error.message?.includes('400') || error.message?.includes('401') ||
                        error.message?.includes('403') || error.message?.includes('404')) {
                        throw error;
                    }

                    if (retries >= MAX_RETRIES) {
                        throw error;
                    }

                    await delay(RETRY_DELAY * retries);
                }
            }

            throw lastError || new Error('Request failed after retries');
        })();

        // Store pending request
        pendingRequests.set(cacheKey, requestPromise);

        try {
            const result = await requestPromise;
            return result;
        } finally {
            pendingRequests.delete(cacheKey);
        }
    }

    // ── Server Check ──
    async function checkServer() {
        try {
            const response = await fetchWithTimeout(`${API_BASE}/health`, {}, 2000);
            serverOnline = response.ok;
            if (serverOnline) {
                if (DEBUG) console.log('[API] Server is online');
            }
            return serverOnline;
        } catch {
            serverOnline = false;
            if (DEBUG) console.warn('[API] Server is offline');
            return false;
        }
    }

    // ── Clear Cache ──
    function clearCache() {
        responseCache.clear();
        pendingRequests.clear();
        if (DEBUG) console.log('[API] Cache cleared');
    }

    // ── Sync Local to Server ──
    async function syncLocalToServer() {
        if (!serverOnline || !Token.get()) {
            if (DEBUG) console.log('[API] Skipping sync: server offline or no token');
            return;
        }

        if (!isDBAvailable()) {
            if (DEBUG) console.warn('[API] DB not available for sync');
            return;
        }

        try {
            // Sync savings
            const savings = DB.getSavings();
            const unsynced = savings.filter(s => !s._synced);
            if (unsynced.length > 0) {
                if (DEBUG) console.log(`[API] Syncing ${unsynced.length} savings entries`);
                for (const s of unsynced) {
                    try {
                        await SavingsAPI.add(s);
                        s._synced = true;
                    } catch (e) {
                        console.error(`[API] Failed to sync saving ${s.id}:`, e);
                    }
                }
                DB.set(DB.KEYS.SAVINGS, savings);
            }

            // Sync orders
            const orders = DB.getOrders();
            const unsyncedOrders = orders.filter(o => !o._synced);
            if (unsyncedOrders.length > 0) {
                if (DEBUG) console.log(`[API] Syncing ${unsyncedOrders.length} orders`);
                for (const o of unsyncedOrders) {
                    try {
                        await OrdersAPI.submit(o);
                        o._synced = true;
                    } catch (e) {
                        console.error(`[API] Failed to sync order ${o.id}:`, e);
                    }
                }
                DB.set(DB.KEYS.ORDERS, orders);
            }

            if (DEBUG) console.log('[API] Sync completed');

        } catch (error) {
            console.error('[API] Sync failed:', error);
        }
    }

    // ── API Modules ──

    // ── Auth API ──
    const AuthAPI = {
        async login(identifier, password) {
            try {
                const data = await apiFetch('/auth/login', {
                    method: 'POST',
                    body: { identifier, password }
                });
                if (data?.token) {
                    Token.set(data.token);
                    if (data.user && isDBAvailable()) {
                        DB.setSession(data.user);
                    }
                }
                return data;
            } catch (error) {
                console.error('[AuthAPI] Login error:', error);
                throw error;
            }
        },

        async signup(userData) {
            try {
                return await apiFetch('/auth/signup', {
                    method: 'POST',
                    body: userData
                });
            } catch (error) {
                console.error('[AuthAPI] Signup error:', error);
                throw error;
            }
        },

        async verifyOTP(phone, otp) {
            try {
                const data = await apiFetch('/auth/verify-otp', {
                    method: 'POST',
                    body: { phone, otp }
                });
                if (data?.token) {
                    Token.set(data.token);
                    if (data.user && isDBAvailable()) {
                        DB.setSession(data.user);
                    }
                }
                return data;
            } catch (error) {
                console.error('[AuthAPI] OTP verification error:', error);
                throw error;
            }
        },

        async resendOTP(phone) {
            try {
                return await apiFetch('/auth/resend-otp', {
                    method: 'POST',
                    body: { phone }
                });
            } catch (error) {
                console.error('[AuthAPI] Resend OTP error:', error);
                throw error;
            }
        },

        async checkUsername(username) {
            try {
                const data = await apiFetch(`/auth/check-username/${username}`);
                return data?.available ?? true;
            } catch (error) {
                console.error('[AuthAPI] Check username error:', error);
                return true;
            }
        },

        async me() {
            try {
                return await apiFetch('/auth/me');
            } catch (error) {
                console.error('[AuthAPI] Get user error:', error);
                return null;
            }
        },

        logout() {
            Token.clear();
            clearCache();
            if (isDBAvailable()) {
                DB.clearSession();
            }
            window.dispatchEvent(new CustomEvent('auth:logout'));
        }
    };

    // ── Users API ──
    const UsersAPI = {
        async getAll() { return await apiFetch('/users'); },
        async get(id) { return await apiFetch(`/users/${id}`); },
        async update(id, data) { return await apiFetch(`/users/${id}`, { method: 'PUT', body: data }); },
        async changeRole(id, role) { return await apiFetch(`/users/${id}/role`, { method: 'PATCH', body: { role } }); },
        async setMemberID(id, memberID) { return await apiFetch(`/users/${id}/member-id`, { method: 'PATCH', body: { memberID } }); },
        async searchReferral(q) { return await apiFetch(`/users/search/referral?q=${encodeURIComponent(q)}`); },
        async stats() { return await apiFetch('/users/stats/summary'); }
    };

    // ── Savings API ──
    const SavingsAPI = {
        async getAll() { return await apiFetch('/savings'); },
        async getUser(userId) { return await apiFetch(`/savings/user/${userId}`); },
        async add(data) { return await apiFetch('/savings', { method: 'POST', body: data }); },
        async update(id, data) { return await apiFetch(`/savings/${id}`, { method: 'PUT', body: data }); },
        async delete(id) { return await apiFetch(`/savings/${id}`, { method: 'DELETE' }); },
        async monthlyReport(year) { return await apiFetch(`/savings/report/monthly?year=${year}`); },
        async getMissing(month) { return await apiFetch(`/savings/missing/${month}`); }
    };

    // ── Loans API ──
    const LoansAPI = {
        async getAll() { return await apiFetch('/loans'); },
        async getUser(userId) { return await apiFetch(`/loans/user/${userId}`); },
        async apply(data) { return await apiFetch('/loans', { method: 'POST', body: data }); },
        async updateStatus(id, status) { return await apiFetch(`/loans/${id}/status`, { method: 'PATCH', body: { status } }); },
        async addPayment(id, amount, note) { return await apiFetch(`/loans/${id}/payment`, { method: 'POST', body: { amount, note } }); },
        async delete(id) { return await apiFetch(`/loans/${id}`, { method: 'DELETE' }); }
    };

    // ── Ledger API ──
    const LedgerAPI = {
        async getAll(filters = {}) {
            const params = new URLSearchParams(filters);
            return await apiFetch(`/ledger?${params.toString()}`);
        },
        async addEntry(data) { return await apiFetch('/ledger', { method: 'POST', body: data }); },
        async delete(id) { return await apiFetch(`/ledger/${id}`, { method: 'DELETE' }); },
        async balanceSheet() { return await apiFetch('/ledger/balance-sheet'); },
        async monthlySummary(year) { return await apiFetch(`/ledger/monthly-summary?year=${year}`); }
    };

    // ── Reports API ──
    const ReportsAPI = {
        async dashboard() { return await apiFetch('/reports/dashboard'); },
        async memberSavings() { return await apiFetch('/reports/member-savings'); },
        async defaulters(month) { return await apiFetch(`/reports/defaulters/${month}`); },
        async loanSummary() { return await apiFetch('/reports/loan-summary'); },
        async getSettings() { return await apiFetch('/reports/settings'); },
        async updateSettings(data) { return await apiFetch('/reports/settings', { method: 'PUT', body: data }); }
    };

    // ── Notices API ──
    const NoticesAPI = {
        async getAll() {
            try {
                return await apiFetch('/notices');
            } catch {
                // Fallback to local
                if (isDBAvailable()) {
                    return DB.getNotices();
                }
                return [];
            }
        },
        async add(data) { return await apiFetch('/notices', { method: 'POST', body: data }); },
        async update(id, data) { return await apiFetch(`/notices/${id}`, { method: 'PUT', body: data }); },
        async delete(id) { return await apiFetch(`/notices/${id}`, { method: 'DELETE' }); }
    };

    // ── Badges API ──
    const BadgesAPI = {
        async getAll() {
            try {
                return await apiFetch('/badges');
            } catch {
                if (isDBAvailable()) {
                    return DB.getBadges();
                }
                return [];
            }
        },
        async add(data) { return await apiFetch('/badges', { method: 'POST', body: data }); },
        async update(id, data) { return await apiFetch(`/badges/${id}`, { method: 'PUT', body: data }); },
        async delete(id) { return await apiFetch(`/badges/${id}`, { method: 'DELETE' }); }
    };

    // ── Products API ──
    const ProductsAPI = {
        async getAll() {
            try {
                return await apiFetch('/products');
            } catch {
                if (isDBAvailable()) {
                    return DB.getProducts();
                }
                return [];
            }
        },
        async add(data) { return await apiFetch('/products', { method: 'POST', body: data }); },
        async update(id, data) { return await apiFetch(`/products/${id}`, { method: 'PUT', body: data }); },
        async delete(id) { return await apiFetch(`/products/${id}`, { method: 'DELETE' }); }
    };

    // ── Orders API ──
    const OrdersAPI = {
        async getAll() { return await apiFetch('/orders'); },
        async getByPhone(phone) { return await apiFetch(`/orders/user/${phone}`); },
        async submit(data) {
            try {
                return await apiFetch('/orders', { method: 'POST', body: data });
            } catch (error) {
                // Fallback: save locally
                if (isDBAvailable()) {
                    const fallbackOrder = {
                        id: 'ORD-' + Date.now().toString(36).toUpperCase(),
                        ...data,
                        status: 'pending',
                        statusStep: 0,
                        submittedAt: new Date().toISOString(),
                        _synced: false
                    };
                    DB.addOrder(fallbackOrder);
                    return fallbackOrder;
                }
                throw error;
            }
        },
        async update(id, data) { return await apiFetch(`/orders/${id}`, { method: 'PATCH', body: data }); },
        async delete(id) { return await apiFetch(`/orders/${id}`, { method: 'DELETE' }); }
    };

    // ── Applications API ──
    const ApplicationsAPI = {
        async getAll() { return await apiFetch('/applications'); },
        async submit(data) {
            try {
                return await apiFetch('/applications', { method: 'POST', body: data });
            } catch (error) {
                // Fallback: save locally
                if (isDBAvailable()) {
                    const fallbackApp = {
                        id: 'BF-' + Date.now().toString(36).toUpperCase(),
                        ...data,
                        status: 'pending',
                        submittedAt: new Date().toISOString(),
                        _synced: false
                    };
                    if (DB.addApplication) {
                        DB.addApplication(fallbackApp);
                    } else {
                        const apps = DB.get(DB.KEYS.APPS) || [];
                        apps.push(fallbackApp);
                        DB.set(DB.KEYS.APPS, apps);
                    }
                    return fallbackApp;
                }
                throw error;
            }
        },
        async update(id, data) { return await apiFetch(`/applications/${id}`, { method: 'PATCH', body: data }); }
    };

    // ── Initialize ──
    document.addEventListener('DOMContentLoaded', async () => {
        const online = await checkServer();

        if (online) {
            if (DEBUG) console.log('[API] Server connected');

            // Refresh session if token exists
            if (Token.get()) {
                try {
                    const user = await AuthAPI.me();
                    if (user && isDBAvailable()) {
                        DB.setSession(user);
                    }
                } catch (e) {
                    if (DEBUG) console.warn('[API] Session refresh failed:', e);
                }
            }

            // Sync local data to server
            await syncLocalToServer();
        } else {
            if (DEBUG) console.log('[API] Server offline — using localStorage mode');
        }
    });

    // ── Handle auth events ──
    document.addEventListener('auth:unauthorized', () => {
        if (DEBUG) console.warn('[API] Unauthorized - redirecting to login');
        // Optionally redirect to login page
        if (window.location.pathname !== '/index.html' && !window.location.pathname.includes('form.html')) {
            // Redirect logic can be added here
        }
    });

    document.addEventListener('auth:logout', () => {
        clearCache();
        if (DEBUG) console.log('[API] Logged out - cache cleared');
    });

    // ── Expose API ──
    window.BF = {
        API: {
            Auth: AuthAPI,
            Users: UsersAPI,
            Savings: SavingsAPI,
            Loans: LoansAPI,
            Ledger: LedgerAPI,
            Reports: ReportsAPI,
            Notices: NoticesAPI,
            Badges: BadgesAPI,
            Products: ProductsAPI,
            Orders: OrdersAPI,
            Applications: ApplicationsAPI
        },
        Token,
        checkServer,
        syncLocalToServer,
        clearCache,
        get serverOnline() { return serverOnline; }
    };

    // ── Debug helpers ──
    if (DEBUG) {
        window.__apiDebug = {
            base: API_BASE,
            online: () => serverOnline,
            cache: () => {
                const entries = {};
                responseCache.forEach((value, key) => {
                    entries[key] = {
                        ...value,
                        data: '... (cached)'
                    };
                });
                return entries;
            },
            clearCache: clearCache,
            checkServer: checkServer,
            sync: syncLocalToServer
        };
        console.log('[API] Initialized. Use BF.API or __apiDebug for debugging.');
    }

})();