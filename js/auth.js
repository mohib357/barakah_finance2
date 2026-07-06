// C:\Project\barakah_finance2\js\auth.js

(function () {
    'use strict';

    // ── Constants ──
    const DEBUG = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const SESSION_KEY = 'bf_session';
    const REMEMBER_KEY = 'bf_remember';
    const DARK_KEY = 'bf_dark';

    // ── Helper: Check if DB is available ──
    function isDBAvailable() {
        return typeof DB !== 'undefined' && DB !== null;
    }

    // ── Helper: Basic password hash (for local storage only - use bcrypt in production) ──
    function hashPassword(password) {
        // Simple Base64 encoding - NOT for production use!
        // In production, use bcrypt on the server side
        if (window.btoa) {
            return btoa(password);
        }
        return password;
    }

    // ── Helper: Verify password ──
    function verifyPassword(input, stored) {
        // For local storage with basic hashing
        if (window.btoa) {
            return btoa(input) === stored;
        }
        return input === stored;
    }

    // ── Helper: Show toast message ──
    function showToastMessage(msg, color = '#065F46') {
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
            padding: 12px 20px;
            border-radius: 10px;
            font-family: 'Noto Serif Bengali', serif;
            font-size: 14px;
            z-index: 99999;
            box-shadow: 0 6px 20px rgba(0,0,0,.25);
            animation: slideUpG 0.3s ease;
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

    // ── Ensure animation keyframes exist ──
    (function ensureToastAnimation() {
        if (!document.querySelector('style[data-toast-animation]')) {
            const style = document.createElement('style');
            style.dataset.toastAnimation = '1';
            style.textContent = `
                @keyframes slideUpG {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }
    })();

    // ════════ NAV / SCROLL UTILS ════════

    function smScroll(id) {
        if (!isDBAvailable()) return;
        const el = document.getElementById(id);
        if (!el) return;
        const nav = document.querySelector('nav');
        const navHeight = nav ? nav.offsetHeight : 80;
        window.scrollTo({ top: el.offsetTop - navHeight - 20, behavior: 'smooth' });
        toggleMob(false);
    }

    function toggleMob(force) {
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

    // ════════ DARK MODE ════════

    function toggleDark() {
        document.body.classList.toggle('dark-mode');
        const toggle = document.getElementById('dkTog');
        if (toggle) toggle.classList.toggle('on');
        localStorage.setItem(DARK_KEY, document.body.classList.contains('dark-mode') ? '1' : '0');
    }

    // Apply saved dark mode on load
    (function applySavedDarkMode() {
        if (localStorage.getItem(DARK_KEY) === '1') {
            document.body.classList.add('dark-mode');
            const toggle = document.getElementById('dkTog');
            if (toggle) toggle.classList.add('on');
        }
    })();

    // ════════ MOBILE MENU STYLE FIX ════════
    (function fixMobileMenuStyle() {
        if (!document.querySelector('style[data-mobile-fix]')) {
            const style = document.createElement('style');
            style.dataset.mobileFix = '1';
            style.textContent = '.nav-mobile.active { left: 0 !important; display: flex !important; }';
            document.head.appendChild(style);
        }
    })();

    // ════════ MODAL CONTROL ════════

    let _authMode = 'login';
    let _pendingUser = null;
    let _otpPhone = null;
    let _otpInterval = null;
    let _otpTimeout = 300;

    function openAuthModal(mode, role) {
        const modal = document.getElementById('authModal');
        if (!modal) return;

        modal.classList.remove('hidden');
        setPanel(mode || 'login');

        const headTxt = document.getElementById('auth-head-txt');
        if (role && headTxt) {
            const labels = { admin: 'অ্যাডমিন', member: 'সদস্য', customer: 'গ্রাহক' };
            headTxt.textContent = (labels[role] || 'বারাকাহ') + ' লগইন';
        }
    }

    function closeAuth() {
        const modal = document.getElementById('authModal');
        if (modal) modal.classList.add('hidden');
        clearAAlerts();
        clearInterval(_otpInterval);
    }

    function setAtab(tab) {
        ['login', 'signup'].forEach(x => {
            const el = document.getElementById('atab-' + x);
            if (el) el.classList.toggle('on', x === tab);
        });
        setPanel(tab);
    }

    function setPanel(panel) {
        ['login', 'signup', 'otp', 'forgot'].forEach(x => {
            const el = document.getElementById('ap-' + x);
            if (el) el.classList.toggle('hidden', x !== panel);
        });
        clearAAlerts();
    }

    function aAlert(msg, type, panel) {
        const el = document.getElementById('al-' + (panel || 'login'));
        if (!el) return;
        el.className = 'aalert aalert-' + (type === 'ok' ? 'ok' : 'err');
        el.textContent = msg;
        el.classList.remove('hidden');
    }

    function clearAAlerts() {
        document.querySelectorAll('.aalert').forEach(el => el.classList.add('hidden'));
    }

    // ════════ LOGIN ════════

    function doLogin() {
        const idEl = document.getElementById('li-id');
        const pwEl = document.getElementById('li-pw');
        if (!idEl || !pwEl) {
            aAlert('ফর্ম এলিমেন্ট পাওয়া যায়নি', 'err', 'login');
            return;
        }

        const identifier = idEl.value.trim();
        const password = pwEl.value;

        if (!identifier || !password) {
            aAlert('সকল তথ্য পূরণ করুন।', 'err', 'login');
            return;
        }

        if (!isDBAvailable()) {
            aAlert('ডাটাবেস লোড হয়নি। পৃষ্ঠা রিফ্রেশ করুন।', 'err', 'login');
            return;
        }

        const user = DB.findUser(identifier);
        if (!user) {
            aAlert('ব্যবহারকারী খুঁজে পাওয়া যায়নি।', 'err', 'login');
            return;
        }

        // Check password (with hash support)
        const passwordValid = user.password && (
            verifyPassword(password, user.password) ||
            user.password === password // Fallback for plain text
        );

        if (!passwordValid) {
            aAlert('পাসওয়ার্ড ভুল!', 'err', 'login');
            return;
        }

        if (!user.verified) {
            aAlert('অ্যাকাউন্ট যাচাই হয়নি। OTP যাচাই করুন।', 'err', 'login');
            return;
        }

        // Login success
        DB.setSession(user);

        const rememberEl = document.getElementById('li-rem');
        if (rememberEl && rememberEl.checked) {
            localStorage.setItem(REMEMBER_KEY, user.id);
        }

        onLoginSuccess(user);
    }

    // ════════ SIGNUP ════════

    function doSignup() {
        const name = document.getElementById('su-name')?.value.trim();
        const phone = document.getElementById('su-phone')?.value.replace(/\D/g, '');
        const username = document.getElementById('su-uname')?.value.trim();
        const password = document.getElementById('su-pw')?.value;
        const password2 = document.getElementById('su-pw2')?.value;
        const terms = document.getElementById('su-terms')?.checked;
        const surname = document.getElementById('su-sname')?.value.trim() || '';
        const dob = document.getElementById('su-dob')?.value || '';
        const email = document.getElementById('su-email')?.value.trim() || '';
        const referral = document.getElementById('su-ref-val')?.value || '';

        // Validation
        if (!name || !phone || !username || !password || !password2) {
            aAlert('তারকা চিহ্নিত সকল তথ্য পূরণ করুন।', 'err', 'signup');
            return;
        }

        if (password.length < 8) {
            aAlert('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।', 'err', 'signup');
            return;
        }

        if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
            aAlert('পাসওয়ার্ডে অক্ষর ও সংখ্যা উভয়ই থাকতে হবে।', 'err', 'signup');
            return;
        }

        if (password !== password2) {
            aAlert('পাসওয়ার্ড মিলছে না।', 'err', 'signup');
            return;
        }

        if (!terms) {
            aAlert('শর্তাবলীতে সম্মতি দিন।', 'err', 'signup');
            return;
        }

        if (!isDBAvailable()) {
            aAlert('ডাটাবেস লোড হয়নি। পৃষ্ঠা রিফ্রেশ করুন।', 'err', 'signup');
            return;
        }

        if (!DB.checkUsername(username)) {
            aAlert('এই ইউজারনেম নেওয়া হয়েছে।', 'err', 'signup');
            return;
        }

        if (DB.findUser(phone)) {
            aAlert('এই নম্বরে ইতিমধ্যে অ্যাকাউন্ট আছে।', 'err', 'signup');
            return;
        }

        if (phone.length < 10) {
            aAlert('সঠিক মোবাইল নম্বর দিন।', 'err', 'signup');
            return;
        }

        // Create pending user (store hashed password for local storage)
        _pendingUser = {
            id: DB.genID('USR'),
            name: name + (surname ? ' ' + surname : ''),
            surname: surname,
            dob: dob,
            phone: phone,
            email: email || null,
            username: username,
            password: hashPassword(password), // Store hashed
            referral: referral || null,
            role: 'user',
            verified: false,
            profileComplete: 40,
            createdAt: new Date().toISOString(),
            memberID: null,
            avatar: null,
        };

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000);
        DB.setOTP(phone, otp);
        _otpPhone = phone;
        _otpTimeout = 300;

        // Log OTP (only in development)
        if (DEBUG) {
            console.log('[DEMO OTP]', phone, '→', otp);
        }

        const displayEl = document.getElementById('otp-phone-display');
        const otpInput = document.getElementById('otp-val');
        if (displayEl) displayEl.textContent = phone;
        if (otpInput) otpInput.value = '';

        startOtpTimer(300);
        setPanel('otp');
        aAlert('OTP পাঠানো হয়েছে (ডেমো: কনসোলে দেখুন)', 'ok', 'otp');
    }

    // ════════ OTP ════════

    function startOtpTimer(seconds) {
        seconds = seconds || 300;
        clearInterval(_otpInterval);

        let remaining = seconds;
        const timerEl = document.getElementById('otp-timer-el');
        if (!timerEl) return;

        _otpInterval = setInterval(function () {
            remaining--;
            const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
            const secs = String(remaining % 60).padStart(2, '0');
            timerEl.textContent = minutes + ':' + secs;

            if (remaining <= 0) {
                clearInterval(_otpInterval);
                timerEl.textContent = '০০:০০';
                _otpTimeout = 0;
            }
        }, 1000);
    }

    function verifyOtp() {
        const code = document.getElementById('otp-val')?.value.trim();
        if (!code) {
            aAlert('OTP লিখুন।', 'err', 'otp');
            return;
        }

        if (!isDBAvailable()) {
            aAlert('ডাটাবেস লোড হয়নি।', 'err', 'otp');
            return;
        }

        if (!DB.verifyOTP(_otpPhone, code)) {
            aAlert('OTP ভুল অথবা মেয়াদ শেষ।', 'err', 'otp');
            return;
        }

        if (!_pendingUser) {
            aAlert('ব্যবহারকারী ডেটা পাওয়া যায়নি। আবার সাইনআপ করুন।', 'err', 'otp');
            return;
        }

        _pendingUser.verified = true;
        DB.addUser(_pendingUser);
        DB.setSession(_pendingUser);

        clearInterval(_otpInterval);
        onLoginSuccess(_pendingUser);
    }

    function resendOtp() {
        if (!_otpPhone) {
            aAlert('ফোন নম্বর পাওয়া যায়নি। আবার সাইনআপ করুন।', 'err', 'otp');
            return;
        }

        const otp = Math.floor(100000 + Math.random() * 900000);
        if (isDBAvailable()) {
            DB.setOTP(_otpPhone, otp);
        }

        if (DEBUG) {
            console.log('[DEMO OTP RESEND]', _otpPhone, '→', otp);
        }

        _otpTimeout = 300;
        startOtpTimer(300);
        aAlert('OTP পুনরায় পাঠানো হয়েছে।', 'ok', 'otp');
    }

    // ════════ FORGOT PASSWORD ════════

    function doForgot() {
        const identifier = document.getElementById('fg-id')?.value.trim();
        if (!identifier) {
            aAlert('নম্বর বা ইমেইল দিন।', 'err', 'forgot');
            return;
        }

        if (!isDBAvailable()) {
            aAlert('ডাটাবেস লোড হয়নি।', 'err', 'forgot');
            return;
        }

        const user = DB.findUser(identifier);
        if (!user) {
            aAlert('অ্যাকাউন্ট পাওয়া যায়নি।', 'err', 'forgot');
            return;
        }

        // In production, this would send an OTP or reset link via email/SMS
        if (DEBUG) {
            aAlert('ডেমো: পাসওয়ার্ড "' + user.password + '" (বাস্তবে OTP যাবে)', 'ok', 'forgot');
        } else {
            aAlert('পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে আপনার ইমেইলে।', 'ok', 'forgot');
        }
    }

    // ════════ AFTER LOGIN ════════

    function onLoginSuccess(user) {
        closeAuth();
        updateNavUI(user);
        showToastMessage('স্বাগতম ' + user.name + '! 🎉', '#065F46');

        // Dispatch event for other scripts
        window.dispatchEvent(new CustomEvent('auth:login', { detail: { user } }));

        // Update badges if function exists
        if (typeof updateBadgeSection === 'function') {
            updateBadgeSection();
        }

        // Redirect admin to admin panel
        if (user.role === 'admin') {
            setTimeout(function () {
                const currentPath = window.location.pathname;
                if (!currentPath.includes('admin')) {
                    window.location.href = 'admin/admin.html';
                }
            }, 700);
        }
    }

    function updateNavUI(user) {
        const loginBtn = document.getElementById('nav-login-btn');
        const userMenu = document.getElementById('nav-user-menu');
        const userName = document.getElementById('nav-user-name');
        const mobileLogin = document.getElementById('mnav-login');
        const mobileUser = document.getElementById('mnav-user');

        if (loginBtn) loginBtn.classList.add('hidden');
        if (userMenu) userMenu.style.display = '';
        if (userName) userName.textContent = user.name;
        if (mobileLogin) mobileLogin.classList.add('hidden');
        if (mobileUser) mobileUser.classList.remove('hidden');
    }

    function doLogout() {
        if (isDBAvailable()) {
            DB.clearSession();
        }
        localStorage.removeItem(REMEMBER_KEY);

        // Dispatch logout event
        window.dispatchEvent(new CustomEvent('auth:logout'));

        // Reload page to reset state
        window.location.reload();
    }

    // ════════ USERNAME HELPERS ════════

    function autoGenerateUsername() {
        const name = document.getElementById('su-name')?.value.trim();
        if (!name || !isDBAvailable()) return;

        const usernameEl = document.getElementById('su-uname');
        if (usernameEl) {
            usernameEl.value = DB.genUsername(name);
            checkUsernameAvailability();
        }
    }

    function checkUsernameAvailability() {
        const username = document.getElementById('su-uname')?.value.trim();
        const hint = document.getElementById('uname-hint');
        if (!hint || !username) {
            if (hint) hint.textContent = '';
            return;
        }

        if (username.length < 3) {
            hint.textContent = '';
            return;
        }

        if (!isDBAvailable()) {
            hint.textContent = '⚠️ ডাটাবেস লোড হয়নি';
            hint.style.color = '#e53e3e';
            return;
        }

        if (DB.checkUsername(username)) {
            hint.textContent = '✅ পাওয়া গেছে!';
            hint.style.color = '#059669';
            hint.className = 'success';
        } else {
            hint.textContent = '❌ নেওয়া হয়েছে';
            hint.style.color = '#e53e3e';
            hint.className = 'error';
        }
    }

    // ════════ REFERRAL SEARCH ════════

    function searchReferral() {
        const query = document.getElementById('su-ref')?.value.trim();
        const resultsBox = document.getElementById('ref-results');
        if (!resultsBox) return;

        resultsBox.innerHTML = '';

        if (!query || query.length < 2 || !isDBAvailable()) return;

        const users = DB.getUsers();
        const results = users.filter(function (u) {
            return u.verified && (
                (u.name || '').includes(query) ||
                (u.phone || '').includes(query) ||
                (u.memberID || '').includes(query)
            );
        }).slice(0, 5);

        if (!results.length) {
            resultsBox.innerHTML = '<div class="ref-item">পাওয়া যায়নি</div>';
            return;
        }

        results.forEach(function (u) {
            const item = document.createElement('div');
            item.className = 'ref-item';
            item.textContent = u.name + ' | ' + u.phone;
            item.onclick = function () {
                const refInput = document.getElementById('su-ref');
                const refVal = document.getElementById('su-ref-val');
                if (refInput) refInput.value = u.name;
                if (refVal) refVal.value = u.id;
                resultsBox.innerHTML = '';
            };
            resultsBox.appendChild(item);
        });
    }

    // ════════ TERMS MODAL ════════

    function openTerms() {
        const modal = document.getElementById('termsModal');
        if (modal) modal.classList.remove('hidden');
    }

    function closeTerms() {
        const modal = document.getElementById('termsModal');
        if (modal) modal.classList.add('hidden');
    }

    // ════════ BADGE DETAIL MODAL ════════

    function openBadgeDetail(key) {
        // This function is now in notice.js
        // But we keep a stub here for backward compatibility
        if (typeof window.openBadgeDetail === 'function') {
            window.openBadgeDetail(key);
        } else {
            showToastMessage('ব্যাজ ডিটেইল লোড হচ্ছে...', '#C9A227');
        }
    }

    function closeBadgeDetail() {
        const modal = document.getElementById('badgeDetailModal');
        if (modal) modal.classList.add('hidden');
    }

    // ════════ QUICK FORMS ════════

    function quickSubmitForm(type) {
        const alertEl = document.getElementById('alert-' + type);
        if (!alertEl) return;

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

        showToastMessage('✓ আবেদন জমা হয়েছে!');

        // Store in local DB if available
        if (isDBAvailable()) {
            const appData = {
                id: DB.genID('APP'),
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

            // Save to applications
            const apps = DB.get(DB.KEYS.APPS) || [];
            apps.push(appData);
            DB.set(DB.KEYS.APPS, apps);
        }
    }

    function previewInstallment() {
        const price = parseFloat(document.getElementById('p-price')?.value) || 0;
        const box = document.getElementById('p-calc-box');
        if (!box) return;

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

    // ════════ SESSION RESTORE ════════

    function restoreSession() {
        if (!isDBAvailable()) return;

        const session = DB.getSession();
        if (session && session.verified) {
            updateNavUI(session);
            if (typeof updateBadgeSection === 'function') {
                updateBadgeSection();
            }
            return;
        }

        // Check remember me
        const rememberId = localStorage.getItem(REMEMBER_KEY);
        if (rememberId) {
            const users = DB.getUsers();
            const user = users.find(function (u) { return u.id === rememberId; });
            if (user && user.verified) {
                DB.setSession(user);
                updateNavUI(user);
                if (typeof updateBadgeSection === 'function') {
                    updateBadgeSection();
                }
            }
        }
    }

    // ════════ GLOBAL EXPOSURE ════════

    // Expose functions globally
    window.smScroll = smScroll;
    window.toggleMob = toggleMob;
    window.toggleDark = toggleDark;
    window.openAuthModal = openAuthModal;
    window.closeAuth = closeAuth;
    window.setAtab = setAtab;
    window.setPanel = setPanel;
    window.aAlert = aAlert;
    window.doLogin = doLogin;
    window.doSignup = doSignup;
    window.verifyOtp = verifyOtp;
    window.resendOtp = resendOtp;
    window.doForgot = doForgot;
    window.doLogout = doLogout;
    window.autoGenerateUsername = autoGenerateUsername;
    window.checkUsernameAvailability = checkUsernameAvailability;
    window.searchReferral = searchReferral;
    window.openTerms = openTerms;
    window.closeTerms = closeTerms;
    window.openBadgeDetail = openBadgeDetail;
    window.closeBadgeDetail = closeBadgeDetail;
    window.quickSubmitForm = quickSubmitForm;
    window.previewInstallment = previewInstallment;
    window.showToastMessage = showToastMessage;

    // ════════ INIT ════════

    document.addEventListener('DOMContentLoaded', function () {
        restoreSession();

        if (DEBUG) {
            console.log('[Auth] Initialized. Session:', isDBAvailable() ? DB.getSession() : 'DB not available');
        }
    });

    // Also run immediately if DOM already loaded
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        restoreSession();
    }

})();