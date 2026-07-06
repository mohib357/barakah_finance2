// C:\Project\barakah_finance2\backend\routes\badges.js

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { db, uuidv4 } = require('../db/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// ── Rate Limiting ──
const publicLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: {
        error: 'অনেক বেশি রিকোয়েস্ট। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: function (req) {
        // Skip rate limiting for admin requests (they have their own limits)
        return req.headers['authorization']?.startsWith('Bearer ');
    }
});

// ── Allowed Fields ──
const ALLOWED_FIELDS = [
    'key',
    'label',
    'icon',
    'show',
    'clickable',
    'order',
    'customVal'
];

// ── Default Badge Order ──
const DEFAULT_BADGES = [
    { key: 'members', label: 'মোট সদস্য', icon: '👥', show: true, clickable: true },
    { key: 'savings', label: 'মোট সঞ্চয়', icon: '💰', show: true, clickable: true },
    { key: 'loans', label: 'করজে হাসানা', icon: '🤝', show: true, clickable: true },
    { key: 'services', label: 'আমাদের সেবা', icon: '🌟', show: true, clickable: true }
];

// ── Helper: Validate Badge Data ──
function validateBadgeData(data) {
    const errors = [];

    if (!data.label || data.label.trim().length < 1) {
        errors.push({ field: 'label', message: 'লেবেল প্রয়োজন' });
    }

    if (!data.key || data.key.trim().length < 1) {
        errors.push({ field: 'key', message: 'কী প্রয়োজন' });
    }

    if (data.icon && data.icon.length > 10) {
        errors.push({ field: 'icon', message: 'আইকন খুব বড় (সর্বোচ্চ ১০ অক্ষর)' });
    }

    return errors;
}

// ── Helper: Sanitize Badge ──
function sanitizeBadge(data) {
    return {
        key: data.key?.trim() || '',
        label: data.label?.trim() || '',
        icon: data.icon?.trim() || '🏅',
        show: data.show === true || data.show === 'true',
        clickable: data.clickable === true || data.clickable === 'true',
        order: parseInt(data.order) || 0,
        customVal: data.customVal?.trim() || ''
    };
}

// ── PUBLIC: Get all badges (with caching) ──
router.get('/',
    publicLimiter,
    [
        query('showHidden').optional().isBoolean(),
        query('sort').optional().isIn(['asc', 'desc'])
    ],
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const showHidden = req.query.showHidden === 'true';
            const sortOrder = req.query.sort === 'desc' ? -1 : 1;

            let badges = db.get('badges').value();

            // Filter out soft-deleted badges
            badges = badges.filter(b => !b.deletedAt);

            // Filter hidden badges unless explicitly requested
            if (!showHidden) {
                badges = badges.filter(b => b.show !== false);
            }

            // Sort by order (if available) then by label
            badges.sort((a, b) => {
                const orderA = a.order || 0;
                const orderB = b.order || 0;
                if (orderA !== orderB) {
                    return (orderA - orderB) * sortOrder;
                }
                return a.label.localeCompare(b.label) * sortOrder;
            });

            // Set cache headers
            res.set('Cache-Control', 'public, max-age=300'); // 5 minutes cache

            res.json(badges);

        } catch (error) {
            console.error('[Badges] GET error:', error);
            res.status(500).json({
                error: 'ব্যাজ লোড করতে সমস্যা',
                code: 'FETCH_ERROR'
            });
        }
    }
);

// ── ADMIN: Create new badge ──
router.post('/',
    verifyToken,
    requireAdmin,
    [
        body('label').notEmpty().withMessage('লেবেল প্রয়োজন'),
        body('key').notEmpty().withMessage('কী প্রয়োজন'),
        body('icon').optional().isString().trim(),
        body('show').optional().isBoolean(),
        body('clickable').optional().isBoolean(),
        body('order').optional().isInt({ min: 0 })
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

            // Sanitize and validate
            const sanitized = sanitizeBadge(req.body);
            const validationErrors = validateBadgeData(sanitized);

            if (validationErrors.length > 0) {
                return res.status(400).json({
                    error: 'ভুল ডেটা',
                    details: validationErrors
                });
            }

            // Check for duplicate key
            const existing = db.get('badges')
                .find({ key: sanitized.key, deletedAt: null })
                .value();

            if (existing) {
                return res.status(409).json({
                    error: `"${sanitized.key}" কী-তে ইতিমধ্যে একটি ব্যাজ রয়েছে`,
                    code: 'DUPLICATE_KEY'
                });
            }

            // Create badge
            const badge = {
                id: uuidv4(),
                ...sanitized,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: req.user.id
            };

            db.get('badges').push(badge).write();

            console.log(`[Badges] Created: ${badge.key} (${badge.id}) by ${req.user.name || req.user.id}`);

            res.status(201).json({
                message: 'ব্যাজ তৈরি হয়েছে',
                badge
            });

        } catch (error) {
            console.error('[Badges] POST error:', error);
            res.status(500).json({
                error: 'ব্যাজ তৈরি করতে সমস্যা',
                code: 'CREATE_ERROR'
            });
        }
    }
);

// ── ADMIN: Update badge (PUT) ──
router.put('/:id',
    verifyToken,
    requireAdmin,
    [
        param('id').notEmpty().withMessage('আইডি প্রয়োজন'),
        body('label').optional().notEmpty().withMessage('লেবেল প্রয়োজন'),
        body('key').optional().notEmpty().withMessage('কী প্রয়োজন')
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

            const badge = db.get('badges')
                .find({ id: req.params.id, deletedAt: null })
                .value();

            if (!badge) {
                return res.status(404).json({
                    error: 'ব্যাজ পাওয়া যায়নি',
                    code: 'NOT_FOUND'
                });
            }

            // Only allow specific fields to be updated
            const updates = {};
            for (const field of ALLOWED_FIELDS) {
                if (req.body[field] !== undefined) {
                    updates[field] = req.body[field];
                }
            }

            // Sanitize updates
            const sanitized = sanitizeBadge({ ...badge, ...updates });
            const validationErrors = validateBadgeData(sanitized);

            if (validationErrors.length > 0) {
                return res.status(400).json({
                    error: 'ভুল ডেটা',
                    details: validationErrors
                });
            }

            // Check for duplicate key (if key is being changed)
            if (updates.key && updates.key !== badge.key) {
                const existing = db.get('badges')
                    .find({ key: sanitized.key, deletedAt: null })
                    .value();

                if (existing && existing.id !== badge.id) {
                    return res.status(409).json({
                        error: `"${sanitized.key}" কী-তে ইতিমধ্যে একটি ব্যাজ রয়েছে`,
                        code: 'DUPLICATE_KEY'
                    });
                }
            }

            // Update badge
            const updatedBadge = {
                ...badge,
                ...sanitized,
                updatedAt: new Date().toISOString(),
                updatedBy: req.user.id
            };

            db.get('badges')
                .find({ id: req.params.id })
                .assign(updatedBadge)
                .write();

            console.log(`[Badges] Updated: ${updatedBadge.key} (${updatedBadge.id}) by ${req.user.name || req.user.id}`);

            res.json({
                message: 'ব্যাজ আপডেট হয়েছে',
                badge: updatedBadge
            });

        } catch (error) {
            console.error('[Badges] PUT error:', error);
            res.status(500).json({
                error: 'ব্যাজ আপডেট করতে সমস্যা',
                code: 'UPDATE_ERROR'
            });
        }
    }
);

// ── ADMIN: Patch badge (partial update) ──
router.patch('/:id',
    verifyToken,
    requireAdmin,
    [
        param('id').notEmpty().withMessage('আইডি প্রয়োজন'),
        body().custom(body => {
            const allowed = ['label', 'key', 'icon', 'show', 'clickable', 'order', 'customVal'];
            for (const key of Object.keys(body)) {
                if (!allowed.includes(key)) {
                    throw new Error(`"${key}" ফিল্ড আপডেট করার অনুমতি নেই`);
                }
            }
            return true;
        })
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

            const badge = db.get('badges')
                .find({ id: req.params.id, deletedAt: null })
                .value();

            if (!badge) {
                return res.status(404).json({
                    error: 'ব্যাজ পাওয়া যায়নি',
                    code: 'NOT_FOUND'
                });
            }

            // Only allow specific fields to be updated
            const updates = {};
            for (const field of ALLOWED_FIELDS) {
                if (req.body[field] !== undefined) {
                    updates[field] = req.body[field];
                }
            }

            // Sanitize updates
            const sanitized = sanitizeBadge({ ...badge, ...updates });

            // Check for duplicate key
            if (updates.key && updates.key !== badge.key) {
                const existing = db.get('badges')
                    .find({ key: sanitized.key, deletedAt: null })
                    .value();

                if (existing && existing.id !== badge.id) {
                    return res.status(409).json({
                        error: `"${sanitized.key}" কী-তে ইতিমধ্যে একটি ব্যাজ রয়েছে`,
                        code: 'DUPLICATE_KEY'
                    });
                }
            }

            // Update badge
            const updatedBadge = {
                ...badge,
                ...sanitized,
                updatedAt: new Date().toISOString(),
                updatedBy: req.user.id
            };

            db.get('badges')
                .find({ id: req.params.id })
                .assign(updatedBadge)
                .write();

            console.log(`[Badges] Patched: ${updatedBadge.key} (${updatedBadge.id}) by ${req.user.name || req.user.id}`);

            res.json({
                message: 'ব্যাজ আপডেট হয়েছে',
                badge: updatedBadge
            });

        } catch (error) {
            console.error('[Badges] PATCH error:', error);
            res.status(500).json({
                error: 'ব্যাজ আপডেট করতে সমস্যা',
                code: 'UPDATE_ERROR'
            });
        }
    }
);

// ── ADMIN: Soft delete badge ──
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

            const badge = db.get('badges')
                .find({ id: req.params.id, deletedAt: null })
                .value();

            if (!badge) {
                return res.status(404).json({
                    error: 'ব্যাজ পাওয়া যায়নি',
                    code: 'NOT_FOUND'
                });
            }

            // Soft delete
            db.get('badges')
                .find({ id: req.params.id })
                .assign({
                    deletedAt: new Date().toISOString(),
                    deletedBy: req.user.id
                })
                .write();

            console.log(`[Badges] Soft deleted: ${badge.key} (${badge.id}) by ${req.user.name || req.user.id}`);

            res.json({
                message: 'ব্যাজ নিষ্ক্রিয় করা হয়েছে',
                id: req.params.id
            });

        } catch (error) {
            console.error('[Badges] DELETE error:', error);
            res.status(500).json({
                error: 'ব্যাজ মুছতে সমস্যা',
                code: 'DELETE_ERROR'
            });
        }
    }
);

// ── ADMIN: Hard delete (permanent) ──
router.delete('/:id/permanent',
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

            const badge = db.get('badges')
                .find({ id: req.params.id })
                .value();

            if (!badge) {
                return res.status(404).json({
                    error: 'ব্যাজ পাওয়া যায়নি',
                    code: 'NOT_FOUND'
                });
            }

            // Hard delete
            db.get('badges')
                .remove({ id: req.params.id })
                .write();

            console.log(`[Badges] Permanently deleted: ${badge.key} (${badge.id}) by ${req.user.name || req.user.id}`);

            res.json({
                message: 'ব্যাজ স্থায়ীভাবে মুছে দেওয়া হয়েছে',
                id: req.params.id
            });

        } catch (error) {
            console.error('[Badges] Hard delete error:', error);
            res.status(500).json({
                error: 'ব্যাজ স্থায়ীভাবে মুছতে সমস্যা',
                code: 'HARD_DELETE_ERROR'
            });
        }
    }
);

// ── ADMIN: Restore soft-deleted badge ──
router.post('/:id/restore',
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

            const badge = db.get('badges')
                .find({ id: req.params.id })
                .value();

            if (!badge) {
                return res.status(404).json({
                    error: 'ব্যাজ পাওয়া যায়নি',
                    code: 'NOT_FOUND'
                });
            }

            if (!badge.deletedAt) {
                return res.status(400).json({
                    error: 'ব্যাজটি মুছে ফেলা হয়নি',
                    code: 'NOT_DELETED'
                });
            }

            // Restore
            db.get('badges')
                .find({ id: req.params.id })
                .assign({
                    deletedAt: null,
                    deletedBy: null,
                    updatedAt: new Date().toISOString()
                })
                .write();

            console.log(`[Badges] Restored: ${badge.key} (${badge.id}) by ${req.user.name || req.user.id}`);

            res.json({
                message: 'ব্যাজ পুনরুদ্ধার করা হয়েছে',
                badge: db.get('badges').find({ id: req.params.id }).value()
            });

        } catch (error) {
            console.error('[Badges] Restore error:', error);
            res.status(500).json({
                error: 'ব্যাজ পুনরুদ্ধার করতে সমস্যা',
                code: 'RESTORE_ERROR'
            });
        }
    }
);

// ── ADMIN: Reorder badges ──
router.post('/reorder',
    verifyToken,
    requireAdmin,
    [
        body('order').isArray().withMessage('অর্ডার অ্যারে প্রয়োজন')
            .custom(order => {
                if (order.length === 0) return true;
                return order.every(item => item.id && typeof item.order === 'number');
            }).withMessage('প্রতিটি আইটেমে id এবং order থাকতে হবে')
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

            const { order } = req.body;

            for (const item of order) {
                db.get('badges')
                    .find({ id: item.id, deletedAt: null })
                    .assign({
                        order: item.order,
                        updatedAt: new Date().toISOString()
                    })
                    .write();
            }

            console.log(`[Badges] Reordered by ${req.user.name || req.user.id}`);

            const updatedBadges = db.get('badges')
                .filter(b => !b.deletedAt)
                .value();

            res.json({
                message: 'ব্যাজ পুনরায় সাজানো হয়েছে',
                badges: updatedBadges
            });

        } catch (error) {
            console.error('[Badges] Reorder error:', error);
            res.status(500).json({
                error: 'ব্যাজ সাজাতে সমস্যা',
                code: 'REORDER_ERROR'
            });
        }
    }
);

// ── ADMIN: Reset to default badges ──
router.post('/reset',
    verifyToken,
    requireAdmin,
    (req, res) => {
        try {
            // Remove all existing badges
            db.set('badges', []).write();

            // Create default badges
            const newBadges = DEFAULT_BADGES.map((b, index) => ({
                id: uuidv4(),
                ...b,
                order: index,
                customVal: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: req.user.id
            }));

            db.get('badges').push(...newBadges).write();

            console.log(`[Badges] Reset to defaults by ${req.user.name || req.user.id}`);

            res.json({
                message: 'ব্যাজ ডিফল্টে রিসেট করা হয়েছে',
                badges: newBadges
            });

        } catch (error) {
            console.error('[Badges] Reset error:', error);
            res.status(500).json({
                error: 'ব্যাজ রিসেট করতে সমস্যা',
                code: 'RESET_ERROR'
            });
        }
    }
);

module.exports = router;