// C:\Project\barakah_finance2\js\simple-auth.js

class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        // Check if user is logged in
        const savedUser = localStorage.getItem('bf_current_user');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            this.updateUI();
        }
    }

    // Signup
    async signup(userData) {
        try {
            // Validate
            if (!userData.username || !userData.password || !userData.mobile) {
                throw new Error('সব তথ্য পূরণ করুন');
            }

            if (userData.password.length < 8) {
                throw new Error('পাসওয়ার্ড কমপক্ষে ৮ অক্ষর হতে হবে');
            }

            // Check if user exists
            const users = this.getAllUsers();
            const exists = users.find(u =>
                u.username === userData.username ||
                u.mobile === userData.mobile
            );

            if (exists) {
                throw new Error('এই ইউজারনেম বা মোবাইল ইতিমধ্যে নিবন্ধিত');
            }

            // Create user
            const newUser = {
                id: `BF-${Date.now().toString(36).toUpperCase()}`,
                username: userData.username,
                password: btoa(userData.password), // Simple encoding (not secure, use bcrypt in production)
                mobile: userData.mobile,
                email: userData.email || '',
                nameBn: userData.nameBn || '',
                dob: userData.dob || '',
                userType: userData.userType || 'customer',
                role: userData.userType === 'member' ? 'member' : 'customer',
                status: 'active',
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString()
            };

            // Save user
            users.push(newUser);
            localStorage.setItem('bf_users', JSON.stringify(users));

            // Auto login
            this.currentUser = newUser;
            localStorage.setItem('bf_current_user', JSON.stringify(newUser));

            this.updateUI();

            return {
                success: true,
                message: 'নিবন্ধন সফল হয়েছে!',
                user: newUser
            };

        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    // Login
    async login(identifier, password) {
        try {
            if (!identifier || !password) {
                throw new Error('ইউজারনেম/মোবাইল এবং পাসওয়ার্ড দিন');
            }

            const users = this.getAllUsers();
            const user = users.find(u =>
                u.username === identifier ||
                u.mobile === identifier ||
                u.email === identifier
            );

            if (!user) {
                throw new Error('ব্যবহারকারী পাওয়া যায়নি');
            }

            // Check password
            const decodedPassword = atob(user.password);
            if (decodedPassword !== password) {
                throw new Error('ভুল পাসওয়ার্ড');
            }

            // Check status
            if (user.status !== 'active') {
                throw new Error('আপনার অ্যাকাউন্ট সক্রিয় নয়');
            }

            // Update last login
            user.lastLogin = new Date().toISOString();
            const userIndex = users.findIndex(u => u.id === user.id);
            users[userIndex] = user;
            localStorage.setItem('bf_users', JSON.stringify(users));

            // Set current user
            this.currentUser = user;
            localStorage.setItem('bf_current_user', JSON.stringify(user));

            this.updateUI();

            return {
                success: true,
                message: 'লগইন সফল!',
                user: user
            };

        } catch (error) {
            return {
                success: false,
                message: error.message
            };
        }
    }

    // Logout
    logout() {
        this.currentUser = null;
        localStorage.removeItem('bf_current_user');
        this.updateUI();

        // Redirect to home
        if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
            window.location.href = '/';
        } else {
            window.location.reload();
        }
    }

    // Get all users
    getAllUsers() {
        const users = localStorage.getItem('bf_users');
        return users ? JSON.parse(users) : [];
    }

    // Update UI based on login status
    updateUI() {
        const loginBtn = document.getElementById('nav-login-btn');
        const userMenu = document.getElementById('nav-user-menu');
        const userName = document.getElementById('nav-user-name');

        if (this.currentUser) {
            // User is logged in
            if (loginBtn) loginBtn.style.display = 'none';
            if (userMenu) userMenu.style.display = 'block';
            if (userName) userName.textContent = this.currentUser.nameBn || this.currentUser.username;
        } else {
            // User is not logged in
            if (loginBtn) loginBtn.style.display = 'block';
            if (userMenu) userMenu.style.display = 'none';
        }
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Check if user is logged in
    isLoggedIn() {
        return this.currentUser !== null;
    }

    // Check user role
    hasRole(role) {
        return this.currentUser && this.currentUser.role === role;
    }
}

// Initialize auth system
window.Auth = new AuthSystem();

// Login function (called from modal)
async function doLogin() {
    const identifier = document.getElementById('li-id')?.value;
    const password = document.getElementById('li-pw')?.value;

    if (!identifier || !password) {
        showAlert('al-login', 'সব তথ্য পূরণ করুন', 'error');
        return;
    }

    const result = await window.Auth.login(identifier, password);

    if (result.success) {
        showAlert('al-login', result.message, 'success');
        setTimeout(() => {
            closeAuthModal();
            window.location.reload();
        }, 1000);
    } else {
        showAlert('al-login', result.message, 'error');
    }
}

// Signup function (called from modal)
async function doSignup() {
    const username = document.getElementById('su-username')?.value;
    const password = document.getElementById('su-pw')?.value;
    const confirmPassword = document.getElementById('su-pw-confirm')?.value;
    const mobile = document.getElementById('su-mobile')?.value;
    const nameBn = document.getElementById('su-name')?.value;

    if (!username || !password || !mobile || !nameBn) {
        showAlert('al-signup', 'সব তথ্য পূরণ করুন', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showAlert('al-signup', 'পাসওয়ার্ড মিলছে না', 'error');
        return;
    }

    const result = await window.Auth.signup({
        username,
        password,
        mobile,
        nameBn,
        userType: 'customer'
    });

    if (result.success) {
        showAlert('al-signup', result.message, 'success');
        setTimeout(() => {
            closeAuthModal();
            window.location.reload();
        }, 1000);
    } else {
        showAlert('al-signup', result.message, 'error');
    }
}

// Logout function
function doLogout() {
    if (confirm('লগআউট করতে চান?')) {
        window.Auth.logout();
    }
}

// Show alert in modal
function showAlert(elementId, message, type) {
    const alertElement = document.getElementById(elementId);
    if (!alertElement) return;

    alertElement.textContent = message;
    alertElement.className = `aalert aalert-${type === 'error' ? 'err' : 'success'}`;
    alertElement.classList.remove('hidden');

    setTimeout(() => {
        alertElement.classList.add('hidden');
    }, 5000);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    if (window.Auth) {
        window.Auth.updateUI();
    }
});
