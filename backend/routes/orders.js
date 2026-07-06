// C:\Project\barakah_finance2\backend\routes\orders.js

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { db, uuidv4 } = require('../db/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// ── Rate Limiting ──
const orderLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 orders per hour per IP
    message: {
        error: 'অনেক বেশি অর্ডার জমা দিয়েছেন। অনুগ্রহ করে ১ ঘন্টা পর চেষ্টা করুন।',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// ── Order Status Constants ──
const ORDER_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    PROCESSING: 'processing',
    DELIVERED: 'delivered'
};

const VALID_STATUSES = Object.values(ORDER_STATUS);

// ── Order Steps ──
const ORDER_STEPS = [
    'আবেদন জমা',
    'কমিটি পর্যালোচনা',
    'অনুমোদন',
    'পণ্য সংগ্রহ',
    'বিতরণ',
    'সম্পন্ন'
];

// ── Allowed Fields for Update ──
const ALLOWED_UPDATE_FIELDS = [
    'status',
    'statusStep',
    'note',
    'deliveryDate',
    'trackingInfo'
];

// ── Helper: Validate order status transition ──
function isValidTransition(currentStatus, newStatus) {
    const transitions = {
        pending: ['approved', 'rejected'],
        approved: ['processing'],
        processing: ['delivered'],
        delivered: [],
        rejected: []
    };

    return transitions[currentStatus]?.includes(newStatus) || false;
}

// ── Helper: Get user by phone ──
function getUserByPhone(phone) {
    return db.get('users').find({ phone }).value();
}

// ── Helper: Add order note ──
function addOrderNote(orderId, note, userId) {
    const order = db.get('orders').find({ id: orderId }).value();
    if (!order) return null;

    if (!order.notes) order.notes = [];
    order.notes.push({
        by: userId,
        note: note,
        timestamp: new Date().toISOString()
    });

    db.get('orders').find({ id: orderId }).assign({ notes: order.notes }).write();
    return order;
}

// ── GET: All orders (Admin only) ──
router.get('/',
    verifyToken,
    requireAdmin,
    [
        query('status').optional().isIn(VALID_STATUSES),
        query('phone').optional().isString().trim(),
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt()
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

            const { status, phone, page = 1, limit = 20 } = req.query;

            let orders = db.get('orders').value();

            // Apply filters
            if (status) orders = orders.filter(o => o.status === status);
            if (phone) orders = orders.filter(o => o.customerPhone === phone);

            // Sort by date (newest first)
            orders.sort((a, b) => {
                const dateA = new Date(a.submittedAt || 0);
                const dateB = new Date(b.submittedAt || 0);
                return dateB - dateA;
            });

            // Calculate stats
            const stats = {
                total: orders.length,
                pending: orders.filter(o => o.status === ORDER_STATUS.PENDING).length,
                approved: orders.filter(o => o.status === ORDER_STATUS.APPROVED).length,
                rejected: orders.filter(o => o.status === ORDER_STATUS.REJECTED).length,
                processing: orders.filter(o => o.status === ORDER_STATUS.PROCESSING).length,
                delivered: orders.filter(o => o.status === ORDER_STATUS.DELIVERED).length
            };

            // Pagination
            const total = orders.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginated = orders.slice(startIndex, endIndex);

            res.json({
                orders: paginated,
                stats,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('[Orders] GET error:', error);
            res.status(500).json({
                error: 'অর্ডার লোড করতে সমস্যা',
                code: 'FETCH_ERROR'
            });
        }
    }
);

// ── GET: Orders by phone (User/Admin) ──
router.get('/user/:phone',
    verifyToken,
    [
        param('phone').notEmpty().withMessage('ফোন নম্বর প্রয়োজন')
    ],
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const phone = req.params.phone;

            // Check permission: user can see their own orders, admin can see all
            if (req.user.phone !== phone && req.user.role !== 'admin') {
                return res.status(403).json({
                    error: 'অ্যাক্সেস নেই',
                    code: 'ACCESS_DENIED'
                });
            }

            const orders = db.get('orders')
                .filter({ customerPhone: phone })
                .value();

            // Sort by date (newest first)
            orders.sort((a, b) => {
                const dateA = new Date(a.submittedAt || 0);
                const dateB = new Date(b.submittedAt || 0);
                return dateB - dateA;
            });

            // Calculate stats
            const stats = {
                total: orders.length,
                pending: orders.filter(o => o.status === ORDER_STATUS.PENDING).length,
                approved: orders.filter(o => o.status === ORDER_STATUS.APPROVED).length,
                processing: orders.filter(o => o.status === ORDER_STATUS.PROCESSING).length,
                delivered: orders.filter(o => o.status === ORDER_STATUS.DELIVERED).length
            };

            res.json({
                orders,
                stats,
                total: orders.length
            });

        } catch (error) {
            console.error('[Orders] GET user error:', error);
            res.status(500).json({
                error: 'অর্ডার লোড করতে সমস্যা',
                code: 'FETCH_ERROR'
            });
        }
    }
);

// ── POST: Submit new order (Public with rate limiting) ──
router.post('/',
    orderLimiter,
    [
        body('productId').notEmpty().withMessage('পণ্য আইডি প্রয়োজন'),
        body('productName').notEmpty().withMessage('পণ্যের নাম প্রয়োজন'),
        body('price').isFloat({ min: 1 }).withMessage('মূল্য সঠিক নয়'),
        body('customerName').notEmpty().withMessage('গ্রাহকের নাম প্রয়োজন'),
        body('customerPhone').isMobilePhone('any').withMessage('সঠিক মোবাইল নম্বর দিন'),
        body('nid').notEmpty().withMessage('এনআইডি নম্বর প্রয়োজন'),
        body('address').notEmpty().withMessage('ঠিকানা প্রয়োজন'),
        body('totalPayable').optional().isFloat({ min: 1 }),
        body('perInstall').optional().isFloat({ min: 1 }),
        body('witness').optional().isString().trim(),
        body('note').optional().isString().trim().isLength({ max: 500 })
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

            const {
                productId,
                productName,
                price,
                customerName,
                customerPhone,
                nid,
                address,
                totalPayable,
                perInstall,
                witness,
                note
            } = req.body;

            // Check if product exists and is in stock
            const product = db.get('products').find({ id: productId }).value();
            if (product && !product.inStock) {
                return res.status(400).json({
                    error: 'এই পণ্যটি বর্তমানে স্টকে নেই',
                    code: 'PRODUCT_OUT_OF_STOCK'
                });
            }

            // Check if customer already has pending order for same product
            const existingOrder = db.get('orders')
                .find({
                    customerPhone,
                    productId,
                    status: ORDER_STATUS.PENDING
                })
                .value();

            if (existingOrder) {
                return res.status(409).json({
                    error: 'আপনার ইতিমধ্যে এই পণ্যের জন্য একটি পেন্ডিং অর্ডার রয়েছে',
                    code: 'DUPLICATE_ORDER'
                });
            }

            // Calculate EMI if not provided
            let total = totalPayable || Math.round(price * 1.10);
            let perInstallment = perInstall || Math.round(total / 6);

            // Create order
            const order = {
                id: `ORD-${Date.now().toString(36).toUpperCase()}`,
                productId,
                productName,
                price: Number(price),
                totalPayable: Number(total),
                perInstall: perInstallment,
                customerName: customerName.trim(),
                customerPhone,
                nid: nid.trim(),
                address: address.trim(),
                witness: witness || '',
                note: note || '',
                status: ORDER_STATUS.PENDING,
                statusStep: 0,
                submittedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                notes: [{
                    by: 'system',
                    note: 'অর্ডার জমা হয়েছে',
                    timestamp: new Date().toISOString()
                }]
            };

            db.get('orders').push(order).write();

            console.log(`[Orders] New order submitted: ${order.id} by ${customerName}`);

            res.status(201).json({
                message: 'অর্ডার জমা হয়েছে',
                order: {
                    id: order.id,
                    productName: order.productName,
                    totalPayable: order.totalPayable,
                    perInstall: order.perInstall,
                    status: order.status,
                    statusStep: order.statusStep,
                    submittedAt: order.submittedAt
                }
            });

        } catch (error) {
            console.error('[Orders] POST error:', error);
            res.status(500).json({
                error: 'অর্ডার জমা দিতে সমস্যা',
                code: 'SUBMIT_ERROR'
            });
        }
    }
);

// ── PATCH: Update order (Admin only) ──
router.patch('/:id',
    verifyToken,
    requireAdmin,
    [
        param('id').notEmpty().withMessage('আইডি প্রয়োজন'),
        body('status').optional().isIn(VALID_STATUSES),
        body('statusStep').optional().isInt({ min: 0, max: 5 }),
        body('note').optional().isString().trim().isLength({ max: 500 }),
        body('deliveryDate').optional().isISO8601(),
        body('trackingInfo').optional().isString().trim()
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

            const order = db.get('orders').find({ id: req.params.id }).value();

            if (!order) {
                return res.status(404).json({
                    error: 'অর্ডার পাওয়া যায়নি',
                    code: 'NOT_FOUND'
                });
            }

            // Only allow specific fields to be updated
            const updates = {};
            for (const field of ALLOWED_UPDATE_FIELDS) {
                if (req.body[field] !== undefined) {
                    updates[field] = req.body[field];
                }
            }

            // Validate status transition
            if (updates.status && order.status !== updates.status) {
                if (!isValidTransition(order.status, updates.status)) {
                    return res.status(400).json({
                        error: `"${order.status}" থেকে "${updates.status}" এ পরিবর্তন করা যাবে না`,
                        code: 'INVALID_TRANSITION'
                    });
                }

                // Add note for status change
                const note = {
                    by: req.user.name || req.user.id,
                    note: `অর্ডার অবস্থা পরিবর্তন: ${order.status} → ${updates.status}`,
                    timestamp: new Date().toISOString()
                };

                if (!order.notes) order.notes = [];
                order.notes.push(note);
                updates.notes = order.notes;

                // Auto-update statusStep based on status
                if (updates.status === ORDER_STATUS.APPROVED && !updates.statusStep) {
                    updates.statusStep = 2; // অনুমোদন step
                }
                if (updates.status === ORDER_STATUS.PROCESSING && !updates.statusStep) {
                    updates.statusStep = 3; // পণ্য সংগ্রহ step
                }
                if (updates.status === ORDER_STATUS.DELIVERED && !updates.statusStep) {
                    updates.statusStep = 5; // সম্পন্ন step
                }
                if (updates.status === ORDER_STATUS.REJECTED && !updates.statusStep) {
                    updates.statusStep = 0; // reset to start
                }

                console.log(`[Orders] Status changed: ${order.id} ${order.status} → ${updates.status} by ${req.user.name || req.user.id}`);
            }

            // If statusStep is updated directly
            if (updates.statusStep !== undefined && updates.statusStep !== order.statusStep) {
                const statusMap = {
                    0: ORDER_STATUS.PENDING,
                    1: ORDER_STATUS.PENDING,
                    2: ORDER_STATUS.APPROVED,
                    3: ORDER_STATUS.PROCESSING,
                    4: ORDER_STATUS.PROCESSING,
                    5: ORDER_STATUS.DELIVERED
                };

                const newStatus = statusMap[updates.statusStep];
                if (newStatus && newStatus !== order.status) {
                    // Validate transition
                    if (!isValidTransition(order.status, newStatus)) {
                        return res.status(400).json({
                            error: `"${order.status}" থেকে "${newStatus}" এ পরিবর্তন করা যাবে না`,
                            code: 'INVALID_TRANSITION'
                        });
                    }
                    updates.status = newStatus;

                    // Add note
                    const note = {
                        by: req.user.name || req.user.id,
                        note: `অর্ডার ধাপ পরিবর্তন: ${ORDER_STEPS[order.statusStep] || '—'} → ${ORDER_STEPS[updates.statusStep]}`,
                        timestamp: new Date().toISOString()
                    };
                    if (!order.notes) order.notes = [];
                    order.notes.push(note);
                    updates.notes = order.notes;

                    console.log(`[Orders] Step changed: ${order.id} ${order.statusStep} → ${updates.statusStep} by ${req.user.name || req.user.id}`);
                }
            }

            // If note is added separately
            if (req.body.note) {
                const note = {
                    by: req.user.name || req.user.id,
                    note: req.body.note,
                    timestamp: new Date().toISOString()
                };
                if (!order.notes) order.notes = [];
                order.notes.push(note);
                updates.notes = order.notes;
            }

            // Add update timestamp
            updates.updatedAt = new Date().toISOString();

            // Update order
            db.get('orders').find({ id: req.params.id }).assign(updates).write();

            const updatedOrder = db.get('orders').find({ id: req.params.id }).value();

            res.json({
                message: 'অর্ডার আপডেট হয়েছে',
                order: {
                    id: updatedOrder.id,
                    status: updatedOrder.status,
                    statusStep: updatedOrder.statusStep,
                    updatedAt: updatedOrder.updatedAt
                }
            });

        } catch (error) {
            console.error('[Orders] PATCH error:', error);
            res.status(500).json({
                error: 'অর্ডার আপডেট করতে সমস্যা',
                code: 'UPDATE_ERROR'
            });
        }
    }
);

// ── DELETE: Delete order (Admin only) ──
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

            const order = db.get('orders').find({ id: req.params.id }).value();

            if (!order) {
                return res.status(404).json({
                    error: 'অর্ডার পাওয়া যায়নি',
                    code: 'NOT_FOUND'
                });
            }

            // Only pending orders can be deleted
            if (order.status !== ORDER_STATUS.PENDING && order.status !== ORDER_STATUS.REJECTED) {
                return res.status(400).json({
                    error: 'শুধুমাত্র পেন্ডিং বা বাতিল অর্ডার মুছা যাবে',
                    code: 'CANNOT_DELETE'
                });
            }

            db.get('orders').remove({ id: req.params.id }).write();

            console.log(`[Orders] Deleted: ${order.id} by ${req.user.name || req.user.id}`);

            res.json({
                message: 'অর্ডার মুছে দেওয়া হয়েছে',
                id: req.params.id
            });

        } catch (error) {
            console.error('[Orders] DELETE error:', error);
            res.status(500).json({
                error: 'অর্ডার মুছতে সমস্যা',
                code: 'DELETE_ERROR'
            });
        }
    }
);

// ── POST: Add note to order (Admin only) ──
router.post('/:id/note',
    verifyToken,
    requireAdmin,
    [
        param('id').notEmpty().withMessage('আইডি প্রয়োজন'),
        body('note').isString().trim().isLength({ min: 1, max: 500 }).withMessage('নোট ১-৫০০ অক্ষরের হতে হবে')
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

            const order = db.get('orders').find({ id: req.params.id }).value();

            if (!order) {
                return res.status(404).json({
                    error: 'অর্ডার পাওয়া যায়নি',
                    code: 'NOT_FOUND'
                });
            }

            const note = {
                by: req.user.name || req.user.id,
                note: req.body.note,
                timestamp: new Date().toISOString()
            };

            if (!order.notes) order.notes = [];
            order.notes.push(note);

            db.get('orders')
                .find({ id: req.params.id })
                .assign({
                    notes: order.notes,
                    updatedAt: new Date().toISOString()
                })
                .write();

            console.log(`[Orders] Note added: ${order.id} by ${req.user.name || req.user.id}`);

            res.json({
                message: 'নোট যোগ করা হয়েছে',
                note
            });

        } catch (error) {
            console.error('[Orders] Note error:', error);
            res.status(500).json({
                error: 'নোট যোগ করতে সমস্যা',
                code: 'NOTE_ERROR'
            });
        }
    }
);

module.exports = router;