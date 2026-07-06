// C:\Project\barakah_finance2\backend\routes\users.js

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { body, param, query, validationResult } = require('express-validator');
const { db } = require('../db/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// ── Helper: Calculate profile completion ──
function calcProfileComplete(user) {
    if (!user) return 0;
    const fields = [
        user.name, user.phone, user.email, user.dob,
        user.occupation || user.job, user.address,
        user.nid, user.username
    ];
    const filled = fields.filter(f => f && f.toString().trim().length > 0).length;
    return Math.round((filled / fields.length) * 100);
}

// ── Helper: Format user for response (remove password) ──
function sanitizeUser(user) {
    if (!user) return null;
    const { password, ...safe } = user;
    return safe;
}

// ── Helper: Get user by ID ──
function getUser(id) {
    return db.get('users').find({ id }).value();
}

// ── GET: All users (Admin only) ──
router.get('/',
    verifyToken,
    requireAdmin,
    [
        query('role').optional().isIn(['admin', 'member', 'customer', 'user']),
        query('verified').optional().isBoolean(),
        query('search').optional().isString().trim(),
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
        query('sort').optional().isIn(['name', 'createdAt', 'lastLogin'])
    ],
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'ভুল ডেটা',
                    details: errors.array()
                });
            }

            const { role, verified, search, page = 1, limit = 20, sort = 'createdAt' } = req.query;

            let users = db.get('users').value();

            // Apply filters
            if (role) users = users.filter(u => u.role === role);
            if (verified !== undefined) {
                const verifiedBool = verified === 'true';
                users = users.filter(u => u.verified === verifiedBool);
            }
            if (search) {
                const q = search.toLowerCase().trim();
                users = users.filter(u =>
                    (u.name || '').toLowerCase().includes(q) ||
                    (u.phone || '').includes(q) ||
                    (u.email || '').toLowerCase().includes(q) ||
                    (u.username || '').toLowerCase().includes(q) ||
                    (u.memberID || '').toLowerCase().includes(q)
                );
            }

            // Sort
            switch (sort) {
                case 'name':
                    users.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                    break;
                case 'lastLogin':
                    users.sort((a, b) => {
                        const dateA = new Date(a.lastLoginAt || 0);
                        const dateB = new Date(b.lastLoginAt || 0);
                        return dateB - dateA;
                    });
                    break;
                case 'createdAt':
                default:
                    users.sort((a, b) => {
                        const dateA = new Date(a.createdAt || 0);
                        const dateB = new Date(b.createdAt || 0);
                        return dateB - dateA;
                    });
            }

            // Calculate stats
            const stats = {
                total: users.length,
                verified: users.filter(u => u.verified).length,
                unverified: users.filter(u => !u.verified).length,
                admins: users.filter(u => u.role === 'admin').length,
                members: users.filter(u => u.role === 'member').length,
                customers: users.filter(u => u.role === 'customer').length,
                users: users.filter(u => u.role === 'user').length
            };

            // Pagination
            const total = users.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginated = users.slice(startIndex, endIndex);

            // Sanitize users (remove passwords)
            const sanitized = paginated.map(u => sanitizeUser(u));

            res.json({
                users: sanitized,
                stats,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('[Users] GET error:', error);
            res.status(500).json({
                error: 'ব্যবহারকারী ডেটা লোড করতে সমস্যা',
                code: 'FETCH_ERROR'
            });
        }
    }
);

// ── GET: Single user ──
router.get('/:id',
    verifyToken,
    [
        param('id').notEmpty().withMessage('আইডি প্রয়োজন')
    ],
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const userId = req.params.id;

            // Check permission
            if (req.user.id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    error: 'অ্যাক্সেস নেই',
                    code: 'ACCESS_DENIED'
                });
            }

            const user = getUser(userId);

            if (!user) {
                return res.status(404).json({
                    error: 'ব্যবহারকারী পাওয়া যায়নি',
                    code: 'USER_NOT_FOUND'
                });
            }

            // Get user stats (savings, loans, orders)
            const savings = db.get('savings').filter({ userId }).value();
            const loans = db.get('loans').filter({ userId }).value();
            const orders = db.get('orders').filter({ customerPhone: user.phone }).value();

            const userStats = {
                savings: {
                    total: savings.reduce((sum, s) => sum + (s.amount || 0), 0),
                    count: savings.length,
                    lateFees: savings.reduce((sum, s) => sum + (s.lateFee || 0), 0)
                },
                loans: {
                    active: loans.filter(l => l.status === 'active').length,
                    total: loans.length,
                    outstanding: loans.filter(l => l.status === 'active')
                        .reduce((sum, l) => sum + (l.remaining || 0), 0)
                },
                orders: {
                    total: orders.length,
                    pending: orders.filter(o => o.status === 'pending').length
                },
                profileComplete: calcProfileComplete(user)
            };

            res.json({
                user: sanitizeUser(user),
                stats: userStats
            });

        } catch (error) {
            console.error('[Users] GET single error:', error);
            res.status(500).json({
                error: 'ব্যবহারকারী লোড করতে সমস্যা',
                code: 'FETCH_ERROR'
            });
        }
    }
);

// ── PUT: Update user profile ──
router.put('/:id',
    verifyToken,
    [
        param('id').notEmpty().withMessage('আইডি প্রয়োজন'),
        body('name').optional().isString().trim().isLength({ min: 2 }),
        body('email').optional().isEmail().withMessage('সঠিক ইমেইল দিন'),
        body('dob').optional().isISO8601().withMessage('সঠিক তারিখ দিন'),
        body('occupation').optional().isString().trim(),
        body('address').optional().isString().trim(),
        body('nid').optional().isString().trim().isLength({ min: 10, max: 17 }),
        body('password').optional().isLength({ min: 8 }).withMessage('পাসওয়ার্ড ৮+ অক্ষরের হতে হবে')
            .matches(/[a-zA-Z]/).withMessage('পাসওয়ার্ডে অক্ষর থাকতে হবে')
            .matches(/[0-9]/).withMessage('পাসওয়ার্ডে সংখ্যা থাকতে হবে')
    ],
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'ভুল ডেটা',
                    details: errors.array()
                });
            }

            const userId = req.params.id;

            // Check permission
            if (req.user.id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    error: 'অ্যাক্সেস নেই',
                    code: 'ACCESS_DENIED'
                });
            }

            const user = getUser(userId);
            if (!user) {
                return res.status(404).json({
                    error: 'ব্যবহারকারী পাওয়া যায়নি',
                    code: 'USER_NOT_FOUND'
                });
            }

            // Build updates
            const updates = {};
            const allowedFields = ['name', 'email', 'dob', 'occupation', 'address', 'nid'];

            for (const field of allowedFields) {
                if (req.body[field] !== undefined) {
                    updates[field] = req.body[field];
                }
            }

            // Handle password separately
            if (req.body.password) {
                updates.password = bcrypt.hashSync(req.body.password, 10);
            }

            // Update profile completion
            const merged = { ...user, ...updates };
            updates.profileComplete = calcProfileComplete(merged);

            // Add audit info
            updates.updatedAt = new Date().toISOString();
            updates.updatedBy = req.user.id;

            // Save
            db.get('users')
                .find({ id: userId })
                .assign(updates)
                .write();

            const updatedUser = getUser(userId);

            console.log(`[Users] Profile updated: ${userId} by ${req.user.name || req.user.id}`);

            res.json({
                message: 'প্রোফাইল আপডেট হয়েছে',
                user: sanitizeUser(updatedUser)
            });

        } catch (error) {
            console.error('[Users] PUT error:', error);
            res.status(500).json({
                error: 'প্রোফাইল আপডেট করতে সমস্যা',
                code: 'UPDATE_ERROR'
            });
        }
    }
);

// ── PATCH: Change user role (Admin only) ──
router.patch('/:id/role',
    verifyToken,
    requireAdmin,
    [
        param('id').notEmpty().withMessage('আইডি প্রয়োজন'),
        body('role').isIn(['admin', 'member', 'customer', 'user']).withMessage('অবৈধ ভূমিকা')
    ],
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'ভুল ডেটা',
                    details: errors.array()
                });
            }

            const userId = req.params.id;
            const { role } = req.body;

            // Prevent changing the last admin
            if (role !== 'admin') {
                const admins = db.get('users').filter(u => u.role === 'admin').value();
                const user = getUser(userId);
                if (user && user.role === 'admin' && admins.length <= 1) {
                    return res.status(400).json({
                        error: 'শেষ অ্যাডমিনের ভূমিকা পরিবর্তন করা যাবে না',
                        code: 'LAST_ADMIN'
                    });
                }
            }

            const user = getUser(userId);
            if (!user) {
                return res.status(404).json({
                    error: 'ব্যবহারকারী পাওয়া যায়নি',
                    code: 'USER_NOT_FOUND'
                });
            }

            db.get('users')
                .find({ id: userId })
                .assign({
                    role,
                    updatedAt: new Date().toISOString(),
                    roleChangedBy: req.user.id,
                    roleChangedAt: new Date().toISOString()
                })
                .write();

            console.log(`[Users] Role changed: ${userId} → ${role} by ${req.user.name || req.user.id}`);

            const updatedUser = getUser(userId);

            res.json({
                message: 'ভূমিকা পরিবর্তন হয়েছে',
                user: sanitizeUser(updatedUser)
            });

        } catch (error) {
            console.error('[Users] Role change error:', error);
            res.status(500).json({
                error: 'ভূমিকা পরিবর্তন করতে সমস্যা',
                code: 'ROLE_CHANGE_ERROR'
            });
        }
    }
);

// ── PATCH: Set member ID (Admin only) ──
router.patch('/:id/member-id',
    verifyToken,
    requireAdmin,
    [
        param('id').notEmpty().withMessage('আইডি প্রয়োজন'),
        body('memberID').isString().trim().notEmpty().withMessage('সদস্য আইডি প্রয়োজন')
    ],
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({
                    error: 'ভুল ডেটা',
                    details: errors.array()
                });
            }

            const userId = req.params.id;
            const { memberID } = req.body;

            // Check for duplicate member ID
            const existing = db.get('users')
                .find({ memberID, id: { $ne: userId } })
                .value();

            if (existing) {
                return res.status(409).json({
                    error: `"${memberID}" সদস্য আইডি ইতিমধ্যে ব্যবহৃত হচ্ছে`,
                    code: 'DUPLICATE_MEMBER_ID'
                });
            }

            const user = getUser(userId);
            if (!user) {
                return res.status(404).json({
                    error: 'ব্যবহারকারী পাওয়া যায়নি',
                    code: 'USER_NOT_FOUND'
                });
            }

            db.get('users')
                .find({ id: userId })
                .assign({
                    memberID,
                    role: 'member',
                    updatedAt: new Date().toISOString()
                })
                .write();

            console.log(`[Users] Member ID set: ${userId} → ${memberID} by ${req.user.name || req.user.id}`);

            const updatedUser = getUser(userId);

            res.json({
                message: 'সদস্য আইডি দেওয়া হয়েছে',
                user: sanitizeUser(updatedUser)
            });

        } catch (error) {
            console.error('[Users] Member ID error:', error);
            res.status(500).json({
                error: 'সদস্য আইডি দিতে সমস্যা',
                code: 'MEMBER_ID_ERROR'
            });
        }
    }
);

// ── DELETE: Delete user (Admin only) ──
router.delete('/:id',
    verifyToken,
    requireAdmin,
    [
        param('id').notEmpty().withMessage('আইডি প্রয়োজন')
    ],
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const userId = req.params.id;

            // Prevent deletion of main admin
            if (userId === 'ADMIN-001') {
                return res.status(400).json({
                    error: 'প্রধান অ্যাডমিন মুছা যাবে না',
                    code: 'CANNOT_DELETE_ADMIN'
                });
            }

            const user = getUser(userId);
            if (!user) {
                return res.status(404).json({
                    error: 'ব্যবহারকারী পাওয়া যায়নি',
                    code: 'USER_NOT_FOUND'
                });
            }

            // Check if user has active loans
            const activeLoans = db.get('loans')
                .filter({ userId, status: 'active' })
                .value();

            if (activeLoans.length > 0) {
                return res.status(400).json({
                    error: `ব্যবহারকারীর ${activeLoans.length} টি সক্রিয় করজ আছে। প্রথমে করজ পরিশোধ করুন।`,
                    code: 'HAS_ACTIVE_LOANS'
                });
            }

            // Soft delete (keep for audit)
            db.get('users')
                .find({ id: userId })
                .assign({
                    deletedAt: new Date().toISOString(),
                    deletedBy: req.user.id,
                    verified: false
                })
                .write();

            console.log(`[Users] Deleted: ${userId} by ${req.user.name || req.user.id}`);

            res.json({
                message: 'ব্যবহারকারী মুছে দেওয়া হয়েছে',
                id: userId
            });

        } catch (error) {
            console.error('[Users] DELETE error:', error);
            res.status(500).json({
                error: 'ব্যবহারকারী মুছতে সমস্যা',
                code: 'DELETE_ERROR'
            });
        }
    }
);

// ── GET: Search referral ──
router.get('/search/referral',
    verifyToken,
    [
        query('q').isString().trim().isLength({ min: 2 }).withMessage('অনুসন্ধান ২+ অক্ষরের হতে হবে')
    ],
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const q = req.query.q.toLowerCase().trim();
            const results = db.get('users')
                .filter(u =>
                    u.verified &&
                    ((u.name || '').toLowerCase().includes(q) ||
                        (u.phone || '').includes(q) ||
                        (u.memberID || '').toLowerCase().includes(q))
                )
                .slice(0, 10)
                .map(u => ({
                    id: u.id,
                    name: u.name,
                    phone: u.phone,
                    memberID: u.memberID || '—'
                }))
                .value();

            res.json(results);

        } catch (error) {
            console.error('[Users] Referral search error:', error);
            res.status(500).json({
                error: 'রেফারেল সার্চ করতে সমস্যা',
                code: 'REFERRAL_SEARCH_ERROR'
            });
        }
    }
);

// ── GET: User statistics (Admin only) ──
router.get('/stats/summary',
    verifyToken,
    requireAdmin,
    (req, res) => {
        try {
            const users = db.get('users').value();
            const currentMonth = new Date().toISOString().slice(0, 7);

            const stats = {
                total: users.length,
                verified: users.filter(u => u.verified).length,
                unverified: users.filter(u => !u.verified).length,
                admins: users.filter(u => u.role === 'admin').length,
                members: users.filter(u => u.role === 'member').length,
                customers: users.filter(u => u.role === 'customer').length,
                users: users.filter(u => u.role === 'user').length,
                newThisMonth: users.filter(u => u.createdAt?.startsWith(currentMonth)).length,
                activeMembers: users.filter(u => u.role === 'member' && u.verified).length,
                // Profile completion stats
                profileComplete: {
                    average: Math.round(users.reduce((sum, u) => sum + (u.profileComplete || 0), 0) / users.length),
                    complete: users.filter(u => (u.profileComplete || 0) >= 80).length,
                    partial: users.filter(u => (u.profileComplete || 0) >= 40 && (u.profileComplete || 0) < 80).length,
                    low: users.filter(u => (u.profileComplete || 0) < 40).length
                }
            };

            res.json(stats);

        } catch (error) {
            console.error('[Users] Stats error:', error);
            res.status(500).json({
                error: 'পরিসংখ্যান লোড করতে সমস্যা',
                code: 'STATS_ERROR'
            });
        }
    }
);

// ── GET: Export users (Admin only) ──
router.get('/export/csv',
    verifyToken,
    requireAdmin,
    [
        query('role').optional().isIn(['admin', 'member', 'customer', 'user'])
    ],
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { role } = req.query;
            let users = db.get('users').value();

            if (role) users = users.filter(u => u.role === role);

            // CSV Headers
            const headers = ['আইডি', 'নাম', 'ইউজারনেম', 'মোবাইল', 'ইমেইল', 'ভূমিকা', 'সদস্য আইডি', 'যাচাইকৃত', 'প্রোফাইল %', 'যোগদানের তারিখ'];
            const rows = users.map(u => [
                u.id || '—',
                u.name || '—',
                u.username || '—',
                u.phone || '—',
                u.email || '—',
                u.role || '—',
                u.memberID || '—',
                u.verified ? '✅' : '❌',
                u.profileComplete || 0,
                u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : '—'
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
            ].join('\n');

            const bom = '\uFEFF';
            const finalContent = bom + csvContent;

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition',
                `attachment; filename=users-${new Date().toISOString().slice(0, 10)}.csv`
            );
            res.send(finalContent);

        } catch (error) {
            console.error('[Users] Export error:', error);
            res.status(500).json({
                error: 'CSV এক্সপোর্ট করতে সমস্যা',
                code: 'EXPORT_ERROR'
            });
        }
    }
);

module.exports = router;