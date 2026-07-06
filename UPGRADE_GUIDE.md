# 🎯 বারাকাহ ফাইন্যান্স - সম্পূর্ণ আপগ্রেড গাইডলাইন

## 📋 বর্তমান অবস্থা
- ✅ ওয়েবসাইট লাইভ: http://app.barakahfinancebd.com/
- ⚠️ LocalStorage ব্যবহার হচ্ছে (Production-ready না)
- ⚠️ User Management System নেই
- ⚠️ Role-based Access Control নেই
- ⚠️ Navigation visibility issue

## 🔴 PHASE 1: তাৎক্ষণিক সমাধান (১-২ ঘণ্টা)

### ধাপ ১.১: Navigation Bar Visibility ফিক্স করা

**সমস্যা**: Normal mode এ nav button গুলো দেখা যায় না

**সমাধান**: 
```css
/app/style/navbar_style.css ফাইলে আপডেট করা হয়েছে

.nav-links li a,
.nav-links li button {
    color: #ffffff !important;  /* সাদা রঙ করা */
    background: rgba(255, 255, 255, 0.12);  /* হালকা background */
    border: 1px solid rgba(255, 255, 255, 0.15);
    padding: 8px 16px;
    border-radius: 8px;
}
```

**করণীয়**:
1. `/app/style/navbar_style.css` ফাইল আপডেট করুন (ইতিমধ্যে করা হয়েছে)
2. GitHub এ push করুন:
   ```bash
   git add .
   git commit -m "Fix: Navigation visibility in light mode"
   git push origin main
   ```
3. cPanel থেকে pull করুন অথবা auto-deploy setup করুন

---

## 🟡 PHASE 2: User Management System (৩-৪ ঘণ্টা)

### ধাপ ২.১: Database Setup - MongoDB Atlas

**কেন MongoDB?**
- বিনামূল্যে 512MB storage
- Global CDN
- Auto-scaling
- Backup সুবিধা

**Setup করুন**:
1. MongoDB Atlas যান: https://www.mongodb.com/cloud/atlas/register
2. নতুন cluster তৈরি করুন (FREE tier)
3. Database user তৈরি করুন
4. IP whitelist করুন (0.0.0.0/0 for development)
5. Connection string কপি করুন

**Connection String**:
```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/barakah_finance?retryWrites=true&w=majority
```

### ধাপ ২.২: Backend API Setup

**File Structure**:
```
/app/backend/
├── config/
│   └── database.js          # MongoDB connection
├── models/
│   ├── User.js             # User schema
│   ├── Role.js             # Role schema
│   └── Permission.js       # Permission schema
├── routes/
│   ├── auth.js             # Login/Signup
│   ├── users.js            # User CRUD
│   └── roles.js            # Role management
├── middleware/
│   ├── auth.js             # JWT verification
│   └── permissions.js      # Check permissions
├── .env                    # Environment variables
└── server.js               # Main server file
```

### ধাপ ২.৩: User Schema তৈরি করুন

**File**: `/app/backend/models/User.js`
```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    userId: { 
        type: String, 
        required: true, 
        unique: true,
        default: function() {
            return `BF-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
        }
    },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    mobile: { type: String, required: true, unique: true },
    email: { type: String },
    
    // Personal Info
    nameBn: { type: String, required: true },
    nameEn: { type: String },
    fatherName: { type: String },
    motherName: { type: String },
    nid: { type: String },
    dob: { type: Date },
    profession: { type: String },
    address: { type: String },
    
    // User Type & Role
    userType: { 
        type: String, 
        enum: ['member', 'customer', 'admin', 'employee'], 
        default: 'customer' 
    },
    role: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Role' 
    },
    
    // Status
    status: { 
        type: String, 
        enum: ['active', 'inactive', 'pending', 'suspended'], 
        default: 'active' 
    },
    emailVerified: { type: Boolean, default: false },
    mobileVerified: { type: Boolean, default: false },
    
    // Member specific
    membershipStartDate: { type: Date },
    membershipType: { type: String },
    referredBy: { type: String },
    
    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    lastLogin: { type: Date }
}, { timestamps: true });

// Hash password before save
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
```

### ধাপ ২.৪: Role & Permission Schema

**File**: `/app/backend/models/Role.js`
```javascript
const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true, 
        unique: true,
        enum: ['super_admin', 'admin', 'committee_member', 'member', 'customer']
    },
    displayName: { type: String, required: true },
    permissions: [{
        resource: { 
            type: String, 
            enum: [
                'users', 'members', 'customers', 'applications', 
                'savings', 'loans', 'products', 'orders', 
                'ledger', 'reports', 'settings', 'notices'
            ]
        },
        actions: [{ 
            type: String, 
            enum: ['create', 'read', 'update', 'delete', 'approve', 'export']
        }]
    }],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Role', roleSchema);
```

---

## 🟢 PHASE 3: Authentication System (২-৩ ঘণ্টা)

### ধাপ ৩.১: JWT Authentication Setup

**Install Dependencies**:
```bash
cd /app/backend
npm install jsonwebtoken bcryptjs dotenv
```

**File**: `/app/backend/middleware/auth.js`
```javascript
const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.protect = async (req, res, next) => {
    try {
        let token;
        
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'লগইন করুন' 
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).populate('role');
        
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'ব্যবহারকারী পাওয়া যায়নি' 
            });
        }
        
        next();
    } catch (error) {
        res.status(401).json({ 
            success: false, 
            message: 'অবৈধ টোকেন' 
        });
    }
};

exports.checkPermission = (resource, action) => {
    return async (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(403).json({ 
                success: false, 
                message: 'অনুমতি নেই' 
            });
        }
        
        // Super admin has all permissions
        if (req.user.role.name === 'super_admin') {
            return next();
        }
        
        // Check specific permission
        const hasPermission = req.user.role.permissions.some(perm => 
            perm.resource === resource && perm.actions.includes(action)
        );
        
        if (!hasPermission) {
            return res.status(403).json({ 
                success: false, 
                message: 'এই কাজের অনুমতি নেই' 
            });
        }
        
        next();
    };
};
```

### ধাপ ৩.২: Auth Routes

**File**: `/app/backend/routes/auth.js`
```javascript
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Signup
router.post('/signup', async (req, res) => {
    try {
        const { 
            username, password, mobile, email, nameBn, 
            dob, userType, referredBy 
        } = req.body;
        
        // Check if user exists
        const existingUser = await User.findOne({ 
            $or: [{ username }, { mobile }] 
        });
        
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'ইউজারনেম বা মোবাইল ইতিমধ্যে নিবন্ধিত'
            });
        }
        
        // Create user
        const user = await User.create({
            username,
            password,
            mobile,
            email,
            nameBn,
            dob,
            userType: userType || 'customer',
            referredBy,
            status: 'pending' // Needs verification
        });
        
        // Generate token
        const token = jwt.sign(
            { id: user._id }, 
            process.env.JWT_SECRET, 
            { expiresIn: '7d' }
        );
        
        res.status(201).json({
            success: true,
            message: 'নিবন্ধন সফল হয়েছে',
            token,
            user: {
                id: user._id,
                userId: user.userId,
                username: user.username,
                nameBn: user.nameBn,
                userType: user.userType,
                status: user.status
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'নিবন্ধনে সমস্যা হয়েছে',
            error: error.message
        });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { identifier, password } = req.body; // username, mobile, or email
        
        // Find user
        const user = await User.findOne({
            $or: [
                { username: identifier },
                { mobile: identifier },
                { email: identifier }
            ]
        }).populate('role');
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'ভুল ইউজারনেম বা পাসওয়ার্ড'
            });
        }
        
        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'ভুল ইউজারনেম বা পাসওয়ার্ড'
            });
        }
        
        // Check status
        if (user.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: 'আপনার অ্যাকাউন্ট সক্রিয় নয়'
            });
        }
        
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        
        // Generate token
        const token = jwt.sign(
            { id: user._id }, 
            process.env.JWT_SECRET, 
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
            message: 'লগইন সফল',
            token,
            user: {
                id: user._id,
                userId: user.userId,
                username: user.username,
                nameBn: user.nameBn,
                userType: user.userType,
                role: user.role,
                permissions: user.role?.permissions || []
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'লগইনে সমস্যা হয়েছে',
            error: error.message
        });
    }
});

// Get current user
router.get('/me', protect, async (req, res) => {
    res.json({
        success: true,
        user: req.user
    });
});

module.exports = router;
```

---

## 🔵 PHASE 4: Frontend Integration (৪-৫ ঘণ্টা)

### ধাপ ৪.১: API Service তৈরি করুন

**File**: `/app/js/api-service.js`
```javascript
class APIService {
    constructor() {
        this.baseURL = 'http://app.barakahfinancebd.com/api'; // Your production URL
        this.token = localStorage.getItem('bf_token');
    }
    
    setToken(token) {
        this.token = token;
        localStorage.setItem('bf_token', token);
    }
    
    clearToken() {
        this.token = null;
        localStorage.removeItem('bf_token');
    }
    
    async request(endpoint, options = {}) {
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                ...options,
                headers
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'অনুরোধ ব্যর্থ হয়েছে');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }
    
    // Auth methods
    async signup(userData) {
        const response = await this.request('/auth/signup', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        
        if (response.success && response.token) {
            this.setToken(response.token);
        }
        
        return response;
    }
    
    async login(identifier, password) {
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ identifier, password })
        });
        
        if (response.success && response.token) {
            this.setToken(response.token);
        }
        
        return response;
    }
    
    async getCurrentUser() {
        return await this.request('/auth/me');
    }
    
    logout() {
        this.clearToken();
        window.location.href = '/index.html';
    }
    
    // User methods
    async getUsers(filters = {}) {
        const query = new URLSearchParams(filters).toString();
        return await this.request(`/users?${query}`);
    }
    
    async createUser(userData) {
        return await this.request('/users', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }
    
    async updateUser(userId, userData) {
        return await this.request(`/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    }
    
    async deleteUser(userId) {
        return await this.request(`/users/${userId}`, {
            method: 'DELETE'
        });
    }
}

// Global instance
window.API = new APIService();
```

---

## 🟣 PHASE 5: Deployment গাইড (১-২ ঘণ্টা)

### ধাপ ৫.১: cPanel এ Node.js Setup

**পদক্ষেপ**:
1. cPanel → Software → Setup Node.js App
2. Create Application:
   - Node.js version: 18.x বা সর্বশেষ
   - Application mode: Production
   - Application root: `/app/backend`
   - Application URL: `api.barakahfinancebd.com` বা subdomain
   - Application startup file: `server.js`

3. Environment Variables যোগ করুন:
   ```
   NODE_ENV=production
   PORT=3001
   MONGODB_URI=mongodb+srv://...
   JWT_SECRET=your-super-secret-key-here
   ```

4. Run NPM Install:
   ```bash
   npm install express mongoose jsonwebtoken bcryptjs dotenv cors
   ```

5. Start Application

### ধাপ ৫.২: .htaccess Setup (Frontend)

**File**: `/app/.htaccess`
```apache
# Enable rewrite engine
RewriteEngine On

# API requests to Node.js backend
RewriteCond %{REQUEST_URI} ^/api/(.*)$
RewriteRule ^api/(.*)$ http://localhost:3001/api/$1 [P,L]

# Frontend routing
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ index.html [L,QSA]

# Cache control
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
</IfModule>

# Compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css text/javascript application/javascript
</IfModule>
```

---

## 📊 চেকলিস্ট

### তাৎক্ষণিক (আজ)
- [✅] Navigation visibility fix
- [ ] GitHub push
- [ ] cPanel deploy

### স্বল্পমেয়াদী (১ সপ্তাহ)
- [ ] MongoDB Atlas setup
- [ ] Backend API implement
- [ ] Auth system complete
- [ ] Frontend integration

### দীর্ঘমেয়াদী (১ মাস)
- [ ] Role management UI
- [ ] Permission system
- [ ] Admin dashboard complete
- [ ] SMS notification
- [ ] Email verification
- [ ] Backup system

---

## 🆘 সাহায্য প্রয়োজন?

যেকোনো ধাপে সমস্যা হলে আমাকে জানান। আমি:
1. কোড লিখে দেব
2. Debug করব
3. Deploy সাহায্য করব
4. Training দেব

**পরবর্তী পদক্ষেপ**: কোন Phase থেকে শুরু করতে চান?
