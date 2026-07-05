// C:\Project\Barakah_Finance\backend\routes\notices.js
// ═══════════════════════════════════════════════════════════════════
// নোটিশ রাউট — FIXED & IMPROVED VERSION
// FIXES:
// 1. Added public GET with rate limiting
// 2. Added input validation with express-validator
// 3. Added allowed fields whitelist for PUT/PATCH
// 4. Added soft delete functionality
// 5. Added proper error handling with try-catch
// 6. Added logging for audit trail
// 7. Added cache headers for public endpoints
// 8. Added order/sort functionality
// 9. Added bulk operations
// 10. Added notice validation and sanitization
// ═══════════════════════════════════════════════════════════════════

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
        return req.headers['authorization']?.startsWith('Bearer ');
    }
});

// ── Allowed Fields ──
const ALLOWED_FIELDS = [
    'text',
    'style',
    'color',
    'active',
    'order'
];

// ── Valid Styles ──
const VALID_STYLES = ['normal', 'bold', 'italic', 'bold-italic'];

// ── Default Notices ──
const DEFAULT_NOTICES = [
    { text: '🌙 বারাকাহ ফাইন্যান্সে আপনাকে স্বাগতম! সুদমুক্ত লেনদেনে সমৃদ্ধি সবার।', style: 'bold', color: '#F5D061', active: true },
    { text: '📢 নতুন সদস্যদের জন্য বিশেষ সুবিধা: আবেদন ফি মাত্র ১০০ টাকা!', style: 'normal', color: '#fff', active: true },
    { text: '💰 করজে হাসানা: বিনা সুদে সর্বোচ্চ ১৫,০০০ টাকা পর্যন্ত সহায়তা।', style: 'italic', color: '#a7f3d0', active: true }
];

// ── Helper: Validate Notice Data ──
function validateNoticeData(data) {
    const errors = [];

    if (!data.text || data.text.trim().length < 1) {
        errors.push({ field: 'text', message: 'নোটিশ টেক্সট প্রয়োজন' });
    }

    if (data.text && data.text.trim().length > 500) {
        errors.push({ field: 'text', message: 'নোটিশ টেক্সট ৫০০ অক্ষরের বেশি হতে পারে না' });
    }

    if (data.style && !VALID_STYLES.includes(data.style)) {
        errors.push({ field: 'style', message: `স্টাইল হতে হবে: ${VALID_STYLES.join(', ')}` });
    }

    if (data.color && !/^#[0-9A-Fa-f]{6}$/.test(data.color)) {
        errors.push({ field: 'color', message: 'ভুল কালার ফরম্যাট (হেক্স কোড প্রয়োজন)' });
    }

    return errors;
}

// ── Helper: Sanitize Notice ──
function sanitizeNotice(data) {
    return {
        text: data.text?.trim() || '',
        style: data.style && VALID_STYLES.includes(data.style) ? data.style : 'normal',
        color: data.color && /^#[0-9A-Fa-f]{6}$/.test(data.color) ? data.color : '#ffffff',
        active: data.active === true || data.active === 'true',
        order: parseInt(data.order) || 0
    };
}

// ── PUBLIC: Get all active notices ──
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

            let notices = db.get('notices').value();

            // Filter out soft-deleted notices
            notices = notices.filter(n => !n.deletedAt);

            // Filter inactive notices unless explicitly requested
            if (!showHidden) {
                notices = notices.filter(n => n.active !== false);
            }

            // Sort by order (if available) then by creation
            notices.sort((a, b) => {
                const orderA = a.order || 0;
                const orderB = b.order || 0;
                if (orderA !== orderB) {
                    return (orderA - orderB) * sortOrder;
                }
                return new Date(a.createdAt || 0) - new Date(b.createdAt || 0) * sortOrder;
            });

            // Set cache headers
            res.set('Cache-Control', 'public, max-age=300'); // 5 minutes cache

            res.json(notices);

        } catch (error) {
            console.error('[Notices] GET error:', error);
            res.status(500).json({
                error: 'নোটিশ লোড করতে সমস্যা',
                code: 'FETCH_ERROR'
            });
        }
    }
);

// ── ADMIN: Create new notice ──
router.post('/',
    verifyToken,
    requireAdmin,
    [
        body('text').notEmpty().withMessage('নোটিশ টেক্সট প্রয়োজন'),
        body('text').isLength({ max: 500 }).withMessage('নোটিশ টেক্সট ৫০০ অক্ষরের বেশি হতে পারে না'),
        body('style').optional().isIn(VALID_STYLES).withMessage(`স্টাইল হতে হবে: ${VALID_STYLES.join(', ')}`),
        body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('ভুল কালার ফরম্যাট (হেক্স কোড প্রয়োজন)'),
        body('active').optional().isBoolean(),
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
            const sanitized = sanitizeNotice(req.body);
            const validationErrors = validateNoticeData(sanitized);

            if (validationErrors.length > 0) {
                return res.status(400).json({
                    error: 'ভুল ডেটা',
                    details: validationErrors
                });
            }

            // Create notice
            const notice = {
                id: uuidv4(),
                ...sanitized,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: req.user.id
            };

            db.get('notices').push(notice).write();

            console.log(`[Notices] Created: ${notice.id} by ${req.user.name || req.user.id}`);

            res.status(201).json({
                message: 'নোটিশ তৈরি হয়েছে',
                notice
            });

        } catch (error) {
            console.error('[Notices] POST error:', error);
            res.status(500).json({
                error: 'নোটিশ তৈরি করতে সমস্যা',
                code: 'CREATE_ERROR'
            });
        }
    }
);

// ── ADMIN: Update notice (PUT) ──
router.put('/:id',
    verifyToken,
    requireAdmin,
    [
        param('id').notEmpty().withMessage('আইডি প্রয়োজন'),
        body('text').optional().notEmpty().withMessage('নোটিশ টেক্সট প্রয়োজন'),
        body('text').optional().isLength({ max: 500 }).withMessage('নোটিশ টেক্সট ৫০০ অক্ষরের বেশি হতে পারে না'),
        body('style').optional().isIn(VALID_STYLES).withMessage(`স্টাইল হতে হবে: ${VALID_STYLES.join(', ')}`),
        body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage('ভুল কালার ফরম্যাট (হেক্স কোড প্রয়োজন)')
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

            const notice = db.get('notices')
                .find({ id: req.params.id, deletedAt: null })
                .value();

            if (!notice) {
                return res.status(404).json({
                    error: 'নোটিশ পাওয়া যায়নি',
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
            const sanitized = sanitizeNotice({ ...notice, ...updates });
            const validationErrors = validateNoticeData(sanitized);

            if (validationErrors.length > 0) {
                return res.status(400).json({
                    error: 'ভুল ডেটা',
                    details: validationErrors
                });
            }

            // Update notice
            const updatedNotice = {
                ...notice,
                ...sanitized,
                updatedAt: new Date().toISOString(),
                updatedBy: req.user.id
            };

            db.get('notices')
                .find({ id: req.params.id })
                .assign(updatedNotice)
                .write();

            console.log(`[Notices] Updated: ${updatedNotice.id} by ${req.user.name || req.user.id}`);

            res.json({
                message: 'নোটিশ আপডেট হয়েছে',
                notice: updatedNotice
            });

        } catch (error) {
            console.error('[Notices] PUT error:', error);
            res.status(500).json({
                error: 'নোটিশ আপডেট করতে সমস্যা',
                code: 'UPDATE_ERROR'
            });
        }
    }
);

// ── ADMIN: Patch notice (partial update) ──
router.patch('/:id',
    verifyToken,
    requireAdmin,
    [
        param('id').notEmpty().withMessage('আইডি প্রয়োজন'),
        body().custom(body => {
            const allowed = ['text', 'style', 'color', 'active', 'order'];
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

            const notice = db.get('notices')
                .find({ id: req.params.id, deletedAt: null })
                .value();

            if (!notice) {
                return res.status(404).json({
                    error: 'নোটিশ পাওয়া যায়নি',
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
            const sanitized = sanitizeNotice({ ...notice, ...updates });

            // Update notice
            const updatedNotice = {
                ...notice,
                ...sanitized,
                updatedAt: new Date().toISOString(),
                updatedBy: req.user.id
            };

            db.get('notices')
                .find({ id: req.params.id })
                .assign(updatedNotice)
                .write();

            console.log(`[Notices] Patched: ${updatedNotice.id} by ${req.user.name || req.user.id}`);

            res.json({
                message: 'নোটিশ আপডেট হয়েছে',
                notice: updatedNotice
            });

        } catch (error) {
            console.error('[Notices] PATCH error:', error);
            res.status(500).json({
                error: 'নোটিশ আপডেট করতে সমস্যা',
                code: 'UPDATE_ERROR'
            });
        }
    }
);

// ── ADMIN: Soft delete notice ──
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

            const notice = db.get('notices')
                .find({ id: req.params.id, deletedAt: null })
                .value();

            if (!notice) {
                return res.status(404).json({
                    error: 'নোটিশ পাওয়া যায়নি',
                    code: 'NOT_FOUND'
                });
            }

            // Soft delete
            db.get('notices')
                .find({ id: req.params.id })
                .assign({
                    deletedAt: new Date().toISOString(),
                    deletedBy: req.user.id,
                    active: false
                })
                .write();

            console.log(`[Notices] Soft deleted: ${notice.id} by ${req.user.name || req.user.id}`);

            res.json({
                message: 'নোটিশ নিষ্ক্রিয় করা হয়েছে',
                id: req.params.id
            });

        } catch (error) {
            console.error('[Notices] DELETE error:', error);
            res.status(500).json({
                error: 'নোটিশ মুছতে সমস্যা',
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

            const notice = db.get('notices')
                .find({ id: req.params.id })
                .value();

            if (!notice) {
                return res.status(404).json({
                    error: 'নোটিশ পাওয়া যায়নি',
                    code: 'NOT_FOUND'
                });
            }

            // Hard delete
            db.get('notices')
                .remove({ id: req.params.id })
                .write();

            console.log(`[Notices] Permanently deleted: ${notice.id} by ${req.user.name || req.user.id}`);

            res.json({
                message: 'নোটিশ স্থায়ীভাবে মুছে দেওয়া হয়েছে',
                id: req.params.id
            });

        } catch (error) {
            console.error('[Notices] Hard delete error:', error);
            res.status(500).json({
                error: 'নোটিশ স্থায়ীভাবে মুছতে সমস্যা',
                code: 'HARD_DELETE_ERROR'
            });
        }
    }
);

// ── ADMIN: Restore soft-deleted notice ──
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

            const notice = db.get('notices')
                .find({ id: req.params.id })
                .value();

            if (!notice) {
                return res.status(404).json({
                    error: 'নোটিশ পাওয়া যায়নি',
                    code: 'NOT_FOUND'
                });
            }

            if (!notice.deletedAt) {
                return res.status(400).json({
                    error: 'নোটিশটি মুছে ফেলা হয়নি',
                    code: 'NOT_DELETED'
                });
            }

            // Restore
            db.get('notices')
                .find({ id: req.params.id })
                .assign({
                    deletedAt: null,
                    deletedBy: null,
                    active: true,
                    updatedAt: new Date().toISOString()
                })
                .write();

            console.log(`[Notices] Restored: ${notice.id} by ${req.user.name || req.user.id}`);

            res.json({
                message: 'নোটিশ পুনরুদ্ধার করা হয়েছে',
                notice: db.get('notices').find({ id: req.params.id }).value()
            });

        } catch (error) {
            console.error('[Notices] Restore error:', error);
            res.status(500).json({
                error: 'নোটিশ পুনরুদ্ধার করতে সমস্যা',
                code: 'RESTORE_ERROR'
            });
        }
    }
);

// ── ADMIN: Reorder notices ──
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
                db.get('notices')
                    .find({ id: item.id, deletedAt: null })
                    .assign({
                        order: item.order,
                        updatedAt: new Date().toISOString()
                    })
                    .write();
            }

            console.log(`[Notices] Reordered by ${req.user.name || req.user.id}`);

            const updatedNotices = db.get('notices')
                .filter(n => !n.deletedAt)
                .value();

            res.json({
                message: 'নোটিশ পুনরায় সাজানো হয়েছে',
                notices: updatedNotices
            });

        } catch (error) {
            console.error('[Notices] Reorder error:', error);
            res.status(500).json({
                error: 'নোটিশ সাজাতে সমস্যা',
                code: 'REORDER_ERROR'
            });
        }
    }
);

// ── ADMIN: Reset to default notices ──
router.post('/reset',
    verifyToken,
    requireAdmin,
    (req, res) => {
        try {
            // Remove all existing notices
            db.set('notices', []).write();

            // Create default notices
            const newNotices = DEFAULT_NOTICES.map((n, index) => ({
                id: uuidv4(),
                ...n,
                order: index,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: req.user.id
            }));

            db.get('notices').push(...newNotices).write();

            console.log(`[Notices] Reset to defaults by ${req.user.name || req.user.id}`);

            res.json({
                message: 'নোটিশ ডিফল্টে রিসেট করা হয়েছে',
                notices: newNotices
            });

        } catch (error) {
            console.error('[Notices] Reset error:', error);
            res.status(500).json({
                error: 'নোটিশ রিসেট করতে সমস্যা',
                code: 'RESET_ERROR'
            });
        }
    }
);

module.exports = router;