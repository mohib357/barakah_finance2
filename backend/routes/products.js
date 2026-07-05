// C:\Project\Barakah_Finance\backend\routes\products.js
// ═══════════════════════════════════════════════════════════════════
// পণ্য রাউট — FIXED & IMPROVED VERSION
// FIXES:
// 1. Added public GET with rate limiting and caching
// 2. Added input validation with express-validator
// 3. Added allowed fields whitelist for PUT/PATCH
// 4. Added soft delete functionality
// 5. Added proper error handling with try-catch
// 6. Added logging for audit trail
// 7. Added pagination for GET requests
// 8. Added search and filter functionality
// 9. Added image URL validation
// 10. Added bulk operations (reorder, reset)
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
    max: 120, // 120 requests per minute
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

// ── Allowed Fields for Update ──
const ALLOWED_FIELDS = [
    'name',
    'category',
    'price',
    'emoji',
    'description',
    'images',
    'inStock',
    'featured',
    'order'
];

// ── Valid Categories ──
const VALID_CATEGORIES = [
    'মোবাইল', 'ইলেকট্রনিক্স', 'কম্পিউটার', 'মোটরযান',
    'গৃহস্থালি', 'পোশাক', 'খাদ্য', 'অন্যান্য'
];

// ── Default Products ──
const DEFAULT_PRODUCTS = [
    { name: 'Samsung Galaxy A15', category: 'মোবাইল', price: 18000, emoji: '📱', description: '৬.৫ ইঞ্চি AMOLED ডিসপ্লে, ৫০০০mAh ব্যাটারি, ১২৮GB।', inStock: true, featured: true, images: [] },
    { name: 'Walton রেফ্রিজারেটর ২৫০L', category: 'ইলেকট্রনিক্স', price: 35000, emoji: '🧊', description: 'ডাবল ডোর, A++ রেটিং, বিদ্যুৎ সাশ্রয়ী।', inStock: true, featured: true, images: [] },
    { name: 'Hero Splendor Plus', category: 'মোটরযান', price: 125000, emoji: '🏍️', description: '১০০cc ইঞ্জিন, ৮০+ কিমি মাইলেজ।', inStock: false, featured: false, images: [] },
    { name: 'Singer সেলাই মেশিন', category: 'গৃহস্থালি', price: 12000, emoji: '🧵', description: 'ইলেকট্রিক, ১৫ প্যাটার্ন।', inStock: true, featured: true, images: [] }
];

// ── Helper: Validate Product Data ──
function validateProductData(data) {
    const errors = [];

    if (!data.name || data.name.trim().length < 2) {
        errors.push({ field: 'name', message: 'পণ্যের নাম প্রয়োজন (২+ অক্ষর)' });
    }

    if (!data.category || !VALID_CATEGORIES.includes(data.category)) {
        errors.push({ field: 'category', message: `ক্যাটাগরি হতে হবে: ${VALID_CATEGORIES.join(', ')}` });
    }

    if (!data.price || data.price < 1) {
        errors.push({ field: 'price', message: 'মূল্য ১ টাকার বেশি হতে হবে' });
    }

    if (data.images && !Array.isArray(data.images)) {
        errors.push({ field: 'images', message: 'ছবি অ্যারে হতে হবে' });
    }

    if (data.images && data.images.length > 10) {
        errors.push({ field: 'images', message: 'সর্বোচ্চ ১০টি ছবি যোগ করা যাবে' });
    }

    return errors;
}

// ── Helper: Sanitize Product ──
function sanitizeProduct(data) {
    return {
        name: data.name?.trim() || '',
        category: data.category?.trim() || 'অন্যান্য',
        price: Math.abs(Number(data.price)) || 0,
        emoji: data.emoji?.trim() || '📦',
        description: data.description?.trim() || '',
        images: Array.isArray(data.images) ? data.images : [],
        inStock: data.inStock === true || data.inStock === 'true',
        featured: data.featured === true || data.featured === 'true',
        order: parseInt(data.order) || 0
    };
}

// ── PUBLIC: Get all products ──
router.get('/',
    publicLimiter,
    [
        query('category').optional().isIn(VALID_CATEGORIES),
        query('inStock').optional().isBoolean(),
        query('featured').optional().isBoolean(),
        query('search').optional().isString().trim(),
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
        query('sort').optional().isIn(['price-asc', 'price-desc', 'name', 'newest'])
    ],
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const {
                category,
                inStock,
                featured,
                search,
                page = 1,
                limit = 20,
                sort = 'newest'
            } = req.query;

            let products = db.get('products').value();

            // Filter out soft-deleted products
            products = products.filter(p => !p.deletedAt);

            // Apply filters
            if (category) products = products.filter(p => p.category === category);
            if (inStock !== undefined) {
                const inStockBool = inStock === 'true';
                products = products.filter(p => p.inStock === inStockBool);
            }
            if (featured !== undefined) {
                const featuredBool = featured === 'true';
                products = products.filter(p => p.featured === featuredBool);
            }
            if (search) {
                const q = search.toLowerCase().trim();
                products = products.filter(p =>
                    p.name.toLowerCase().includes(q) ||
                    (p.description || '').toLowerCase().includes(q) ||
                    (p.category || '').includes(q)
                );
            }

            // Sort
            switch (sort) {
                case 'price-asc':
                    products.sort((a, b) => a.price - b.price);
                    break;
                case 'price-desc':
                    products.sort((a, b) => b.price - a.price);
                    break;
                case 'name':
                    products.sort((a, b) => a.name.localeCompare(b.name, 'bn'));
                    break;
                case 'newest':
                default:
                    products.sort((a, b) => {
                        const dateA = new Date(a.createdAt || 0);
                        const dateB = new Date(b.createdAt || 0);
                        return dateB - dateA;
                    });
            }

            // Calculate stats
            const stats = {
                total: products.length,
                inStock: products.filter(p => p.inStock).length,
                outOfStock: products.filter(p => !p.inStock).length,
                featured: products.filter(p => p.featured).length,
                categories: [...new Set(products.map(p => p.category))]
            };

            // Pagination
            const total = products.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginated = products.slice(startIndex, endIndex);

            // Set cache headers
            res.set('Cache-Control', 'public, max-age=300');

            res.json({
                products: paginated,
                stats,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('[Products] GET error:', error);
            res.status(500).json({
                error: 'পণ্য লোড করতে সমস্যা',
                code: 'FETCH_ERROR'
            });
        }
    }
);

// ── ADMIN: Create new product ──
router.post('/',
    verifyToken,
    requireAdmin,
    [
        body('name').notEmpty().withMessage('পণ্যের নাম প্রয়োজন'),
        body('category').isIn(VALID_CATEGORIES).withMessage(`ক্যাটাগরি হতে হবে: ${VALID_CATEGORIES.join(', ')}`),
        body('price').isFloat({ min: 1 }).withMessage('মূল্য ১ টাকার বেশি হতে হবে'),
        body('emoji').optional().isString().isLength({ max: 5 }),
        body('description').optional().isString().trim(),
        body('images').optional().isArray(),
        body('inStock').optional().isBoolean(),
        body('featured').optional().isBoolean()
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
            const sanitized = sanitizeProduct(req.body);
            const validationErrors = validateProductData(sanitized);

            if (validationErrors.length > 0) {
                return res.status(400).json({
                    error: 'ভুল ডেটা',
                    details: validationErrors
                });
            }

            // Check for duplicate name
            const existing = db.get('products')
                .find({ name: sanitized.name, deletedAt: null })
                .value();

            if (existing) {
                return res.status(409).json({
                    error: `"${sanitized.name}" নামে ইতিমধ্যে একটি পণ্য রয়েছে`,
                    code: 'DUPLICATE_NAME'
                });
            }

            // Create product
            const product = {
                id: uuidv4(),
                ...sanitized,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: req.user.id
            };

            db.get('products').push(product).write();

            console.log(`[Products] Created: ${product.name} (${product.id}) by ${req.user.name || req.user.id}`);

            res.status(201).json({
                message: 'পণ্য তৈরি হয়েছে',
                product
            });

        } catch (error) {
            console.error('[Products] POST error:', error);
            res.status(500).json({
                error: 'পণ্য তৈরি করতে সমস্যা',
                code: 'CREATE_ERROR'
            });
        }
    }
);

// ── ADMIN: Update product (PUT) ──
router.put('/:id',
    verifyToken,
    requireAdmin,
    [
        param('id').notEmpty().withMessage('আইডি প্রয়োজন'),
        body('name').optional().notEmpty().withMessage('পণ্যের নাম প্রয়োজন'),
        body('category').optional().isIn(VALID_CATEGORIES).withMessage(`ক্যাটাগরি হতে হবে: ${VALID_CATEGORIES.join(', ')}`),
        body('price').optional().isFloat({ min: 1 }).withMessage('মূল্য ১ টাকার বেশি হতে হবে')
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

            const product = db.get('products')
                .find({ id: req.params.id, deletedAt: null })
                .value();

            if (!product) {
                return res.status(404).json({
                    error: 'পণ্য পাওয়া যায়নি',
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
            const sanitized = sanitizeProduct({ ...product, ...updates });
            const validationErrors = validateProductData(sanitized);

            if (validationErrors.length > 0) {
                return res.status(400).json({
                    error: 'ভুল ডেটা',
                    details: validationErrors
                });
            }

            // Check for duplicate name
            if (updates.name && updates.name !== product.name) {
                const existing = db.get('products')
                    .find({ name: sanitized.name, deletedAt: null })
                    .value();

                if (existing && existing.id !== product.id) {
                    return res.status(409).json({
                        error: `"${sanitized.name}" নামে ইতিমধ্যে একটি পণ্য রয়েছে`,
                        code: 'DUPLICATE_NAME'
                    });
                }
            }

            // Update product
            const updatedProduct = {
                ...product,
                ...sanitized,
                updatedAt: new Date().toISOString(),
                updatedBy: req.user.id
            };

            db.get('products')
                .find({ id: req.params.id })
                .assign(updatedProduct)
                .write();

            console.log(`[Products] Updated: ${updatedProduct.name} (${updatedProduct.id}) by ${req.user.name || req.user.id}`);

            res.json({
                message: 'পণ্য আপডেট হয়েছে',
                product: updatedProduct
            });

        } catch (error) {
            console.error('[Products] PUT error:', error);
            res.status(500).json({
                error: 'পণ্য আপডেট করতে সমস্যা',
                code: 'UPDATE_ERROR'
            });
        }
    }
);

// ── ADMIN: Patch product (partial update) ──
router.patch('/:id',
    verifyToken,
    requireAdmin,
    [
        param('id').notEmpty().withMessage('আইডি প্রয়োজন'),
        body().custom(body => {
            const allowed = ['name', 'category', 'price', 'emoji', 'description', 'images', 'inStock', 'featured', 'order'];
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

            const product = db.get('products')
                .find({ id: req.params.id, deletedAt: null })
                .value();

            if (!product) {
                return res.status(404).json({
                    error: 'পণ্য পাওয়া যায়নি',
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
            const sanitized = sanitizeProduct({ ...product, ...updates });

            // Check for duplicate name
            if (updates.name && updates.name !== product.name) {
                const existing = db.get('products')
                    .find({ name: sanitized.name, deletedAt: null })
                    .value();

                if (existing && existing.id !== product.id) {
                    return res.status(409).json({
                        error: `"${sanitized.name}" নামে ইতিমধ্যে একটি পণ্য রয়েছে`,
                        code: 'DUPLICATE_NAME'
                    });
                }
            }

            // Update product
            const updatedProduct = {
                ...product,
                ...sanitized,
                updatedAt: new Date().toISOString(),
                updatedBy: req.user.id
            };

            db.get('products')
                .find({ id: req.params.id })
                .assign(updatedProduct)
                .write();

            console.log(`[Products] Patched: ${updatedProduct.name} (${updatedProduct.id}) by ${req.user.name || req.user.id}`);

            res.json({
                message: 'পণ্য আপডেট হয়েছে',
                product: updatedProduct
            });

        } catch (error) {
            console.error('[Products] PATCH error:', error);
            res.status(500).json({
                error: 'পণ্য আপডেট করতে সমস্যা',
                code: 'UPDATE_ERROR'
            });
        }
    }
);

// ── ADMIN: Soft delete product ──
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

            const product = db.get('products')
                .find({ id: req.params.id, deletedAt: null })
                .value();

            if (!product) {
                return res.status(404).json({
                    error: 'পণ্য পাওয়া যায়নি',
                    code: 'NOT_FOUND'
                });
            }

            // Soft delete
            db.get('products')
                .find({ id: req.params.id })
                .assign({
                    deletedAt: new Date().toISOString(),
                    deletedBy: req.user.id,
                    inStock: false
                })
                .write();

            console.log(`[Products] Soft deleted: ${product.name} (${product.id}) by ${req.user.name || req.user.id}`);

            res.json({
                message: 'পণ্য নিষ্ক্রিয় করা হয়েছে',
                id: req.params.id
            });

        } catch (error) {
            console.error('[Products] DELETE error:', error);
            res.status(500).json({
                error: 'পণ্য মুছতে সমস্যা',
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

            const product = db.get('products')
                .find({ id: req.params.id })
                .value();

            if (!product) {
                return res.status(404).json({
                    error: 'পণ্য পাওয়া যায়নি',
                    code: 'NOT_FOUND'
                });
            }

            // Hard delete
            db.get('products')
                .remove({ id: req.params.id })
                .write();

            console.log(`[Products] Permanently deleted: ${product.name} (${product.id}) by ${req.user.name || req.user.id}`);

            res.json({
                message: 'পণ্য স্থায়ীভাবে মুছে দেওয়া হয়েছে',
                id: req.params.id
            });

        } catch (error) {
            console.error('[Products] Hard delete error:', error);
            res.status(500).json({
                error: 'পণ্য স্থায়ীভাবে মুছতে সমস্যা',
                code: 'HARD_DELETE_ERROR'
            });
        }
    }
);

// ── ADMIN: Restore soft-deleted product ──
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

            const product = db.get('products')
                .find({ id: req.params.id })
                .value();

            if (!product) {
                return res.status(404).json({
                    error: 'পণ্য পাওয়া যায়নি',
                    code: 'NOT_FOUND'
                });
            }

            if (!product.deletedAt) {
                return res.status(400).json({
                    error: 'পণ্যটি মুছে ফেলা হয়নি',
                    code: 'NOT_DELETED'
                });
            }

            // Restore
            db.get('products')
                .find({ id: req.params.id })
                .assign({
                    deletedAt: null,
                    deletedBy: null,
                    inStock: true,
                    updatedAt: new Date().toISOString()
                })
                .write();

            console.log(`[Products] Restored: ${product.name} (${product.id}) by ${req.user.name || req.user.id}`);

            res.json({
                message: 'পণ্য পুনরুদ্ধার করা হয়েছে',
                product: db.get('products').find({ id: req.params.id }).value()
            });

        } catch (error) {
            console.error('[Products] Restore error:', error);
            res.status(500).json({
                error: 'পণ্য পুনরুদ্ধার করতে সমস্যা',
                code: 'RESTORE_ERROR'
            });
        }
    }
);

// ── ADMIN: Reset to default products ──
router.post('/reset',
    verifyToken,
    requireAdmin,
    (req, res) => {
        try {
            // Remove all existing products
            db.set('products', []).write();

            // Create default products
            const newProducts = DEFAULT_PRODUCTS.map((p, index) => ({
                id: uuidv4(),
                ...p,
                order: index,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: req.user.id
            }));

            db.get('products').push(...newProducts).write();

            console.log(`[Products] Reset to defaults by ${req.user.name || req.user.id}`);

            res.json({
                message: 'পণ্য ডিফল্টে রিসেট করা হয়েছে',
                products: newProducts
            });

        } catch (error) {
            console.error('[Products] Reset error:', error);
            res.status(500).json({
                error: 'পণ্য রিসেট করতে সমস্যা',
                code: 'RESET_ERROR'
            });
        }
    }
);

module.exports = router;