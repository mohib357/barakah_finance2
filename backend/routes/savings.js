// C:\Project\Barakah_Finance\backend\routes\savings.js
// ═══════════════════════════════════════════════════════════════════
// সঞ্চয় রাউট — FIXED & IMPROVED VERSION
// FIXES:
// 1. Added input validation with express-validator
// 2. Added duplicate month check for savings
// 3. Added ledger entry with proper error handling
// 4. Added pagination for GET requests
// 5. Added proper error handling with try-catch
// 6. Added logging for audit trail
// 7. Added monthly report with trends
// 8. Added missing member detection
// 9. Added CSV export functionality
// 10. Added bulk import functionality
// ═══════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { db, uuidv4 } = require('../db/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// ── Helper: Add ledger entry ──
function addLedgerEntry(data) {
    const entry = {
        id: `LED-${Date.now().toString(36).toUpperCase()}`,
        ...data,
        date: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        manual: false
    };
    db.get('ledger').push(entry).write();
    return entry;
}

// ── Helper: Check if savings exist for month ──
function hasSavingsForMonth(userId, month) {
    return !!db.get('savings').find({ userId, month }).value();
}

// ── Helper: Get user by ID ──
function getUser(id) {
    return db.get('users').find({ id }).value();
}

// ── GET: All savings (Admin only) ──
router.get('/',
    verifyToken,
    requireAdmin,
    [
        query('userId').optional().isString().trim(),
        query('month').optional().isISO8601().withMessage('সঠিক মাস দিন'),
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

            const { userId, month, page = 1, limit = 50 } = req.query;

            let savings = db.get('savings').value();

            // Apply filters
            if (userId) savings = savings.filter(s => s.userId === userId);
            if (month) savings = savings.filter(s => s.month === month);

            // Sort by date (newest first)
            savings.sort((a, b) => {
                const dateA = new Date(a.date || a.createdAt || 0);
                const dateB = new Date(b.date || b.createdAt || 0);
                return dateB - dateA;
            });

            // Enrich with user names
            const users = db.get('users').value();
            const enriched = savings.map(s => ({
                ...s,
                userName: users.find(u => u.id === s.userId)?.name || s.userName || '—',
                userPhone: users.find(u => u.id === s.userId)?.phone || s.userPhone || '—'
            }));

            // Calculate stats
            const stats = {
                total: savings.length,
                totalAmount: savings.reduce((sum, s) => sum + (s.amount || 0), 0),
                lateFees: savings.reduce((sum, s) => sum + (s.lateFee || 0), 0),
                uniqueUsers: [...new Set(savings.map(s => s.userId))].length
            };

            // Pagination
            const total = enriched.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginated = enriched.slice(startIndex, endIndex);

            // Monthly breakdown (if month filter not applied)
            let monthlyBreakdown = null;
            if (!month) {
                const byMonth = {};
                savings.forEach(s => {
                    const m = s.month || 'unknown';
                    if (!byMonth[m]) byMonth[m] = { count: 0, amount: 0, lateFee: 0 };
                    byMonth[m].count++;
                    byMonth[m].amount += s.amount || 0;
                    byMonth[m].lateFee += s.lateFee || 0;
                });
                monthlyBreakdown = Object.keys(byMonth)
                    .sort()
                    .map(m => ({ month: m, ...byMonth[m] }));
            }

            res.json({
                savings: paginated,
                stats,
                monthlyBreakdown,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('[Savings] GET error:', error);
            res.status(500).json({
                error: 'সঞ্চয় ডেটা লোড করতে সমস্যা',
                code: 'FETCH_ERROR'
            });
        }
    }
);

// ── GET: User savings ──
router.get('/user/:userId',
    verifyToken,
    [
        param('userId').notEmpty().withMessage('ব্যবহারকারী আইডি প্রয়োজন')
    ],
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const userId = req.params.userId;

            // Check permission
            if (req.user.id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    error: 'অ্যাক্সেস নেই',
                    code: 'ACCESS_DENIED'
                });
            }

            const savings = db.get('savings').filter({ userId }).value();
            const total = savings.reduce((sum, s) => sum + (s.amount || 0), 0);
            const lateFees = savings.reduce((sum, s) => sum + (s.lateFee || 0), 0);

            // Monthly breakdown
            const monthly = {};
            savings.forEach(s => {
                if (!monthly[s.month]) monthly[s.month] = { amount: 0, count: 0, lateFee: 0 };
                monthly[s.month].amount += s.amount || 0;
                monthly[s.month].count++;
                monthly[s.month].lateFee += s.lateFee || 0;
            });

            res.json({
                savings: savings.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)),
                total,
                lateFees,
                count: savings.length,
                monthly,
                months: Object.keys(monthly).sort()
            });

        } catch (error) {
            console.error('[Savings] GET user error:', error);
            res.status(500).json({
                error: 'সঞ্চয় ডেটা লোড করতে সমস্যা',
                code: 'FETCH_ERROR'
            });
        }
    }
);

// ── POST: Add savings entry (Admin only) ──
router.post('/',
    verifyToken,
    requireAdmin,
    [
        body('userId').notEmpty().withMessage('ব্যবহারকারী আইডি প্রয়োজন'),
        body('month').isISO8601().withMessage('সঠিক মাস দিন'),
        body('amount').isFloat({ min: 1 }).withMessage('পরিমাণ ১ টাকার বেশি হতে হবে'),
        body('note').optional().isString().trim().isLength({ max: 200 }),
        body('lateFlag').optional().isBoolean(),
        body('lateFee').optional().isFloat({ min: 0 })
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

            const { userId, month, amount, note, lateFlag, lateFee } = req.body;

            // Check if user exists
            const user = getUser(userId);
            if (!user) {
                return res.status(404).json({
                    error: 'ব্যবহারকারী পাওয়া যায়নি',
                    code: 'USER_NOT_FOUND'
                });
            }

            // Check for duplicate entry
            if (hasSavingsForMonth(userId, month)) {
                return res.status(409).json({
                    error: `${month} মাসের সঞ্চয় ইতিমধ্যে যোগ করা হয়েছে`,
                    code: 'DUPLICATE_ENTRY'
                });
            }

            // Get settings for late fee
            const settings = db.get('settings').value();
            const finalLateFee = lateFee !== undefined ? lateFee :
                (lateFlag ? settings.lateFee : 0);

            // Create entry
            const entry = {
                id: `SAV-${Date.now().toString(36).toUpperCase()}`,
                userId,
                userName: user.name,
                userPhone: user.phone,
                month,
                amount: Number(amount),
                note: note || '',
                lateFlag: lateFlag || false,
                lateFee: Number(finalLateFee),
                addedBy: req.user.id,
                date: new Date().toISOString(),
                createdAt: new Date().toISOString()
            };

            db.get('savings').push(entry).write();

            // Add ledger entry for savings
            try {
                addLedgerEntry({
                    type: 'income',
                    category: 'savings',
                    amount: Number(amount),
                    description: `সঞ্চয় জমা — ${user.name} (${month})`,
                    userId,
                    refId: entry.id,
                    addedBy: req.user.id
                });

                // Add late fee if applicable
                if (finalLateFee > 0) {
                    addLedgerEntry({
                        type: 'income',
                        category: 'late_fee',
                        amount: Number(finalLateFee),
                        description: `বিলম্ব ফি — ${user.name} (${month})`,
                        userId,
                        refId: entry.id,
                        addedBy: req.user.id
                    });
                }

                console.log(`[Savings] Added: ${entry.id} for ${user.name} (${month}) by ${req.user.name || req.user.id}`);
            } catch (ledgerError) {
                console.error('[Savings] Ledger entry failed:', ledgerError);
                // Continue - savings is already saved
            }

            res.status(201).json({
                message: 'সঞ্চয় এন্ট্রি যোগ হয়েছে',
                entry
            });

        } catch (error) {
            console.error('[Savings] POST error:', error);
            res.status(500).json({
                error: 'সঞ্চয় এন্ট্রি যোগ করতে সমস্যা',
                code: 'CREATE_ERROR'
            });
        }
    }
);

// ── PUT: Update savings entry (Admin only) ──
router.put('/:id',
    verifyToken,
    requireAdmin,
    [
        param('id').notEmpty().withMessage('আইডি প্রয়োজন'),
        body('amount').optional().isFloat({ min: 1 }).withMessage('পরিমাণ ১ টাকার বেশি হতে হবে'),
        body('note').optional().isString().trim().isLength({ max: 200 }),
        body('lateFee').optional().isFloat({ min: 0 })
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

            const entry = db.get('savings').find({ id: req.params.id }).value();

            if (!entry) {
                return res.status(404).json({
                    error: 'সঞ্চয় এন্ট্রি পাওয়া যায়নি',
                    code: 'NOT_FOUND'
                });
            }

            const updates = {};
            if (req.body.amount !== undefined) updates.amount = Number(req.body.amount);
            if (req.body.note !== undefined) updates.note = req.body.note;
            if (req.body.lateFee !== undefined) updates.lateFee = Number(req.body.lateFee);

            updates.updatedAt = new Date().toISOString();
            updates.updatedBy = req.user.id;

            db.get('savings')
                .find({ id: req.params.id })
                .assign(updates)
                .write();

            const updated = db.get('savings').find({ id: req.params.id }).value();

            console.log(`[Savings] Updated: ${updated.id} by ${req.user.name || req.user.id}`);

            res.json({
                message: 'সঞ্চয় এন্ট্রি আপডেট হয়েছে',
                entry: updated
            });

        } catch (error) {
            console.error('[Savings] PUT error:', error);
            res.status(500).json({
                error: 'সঞ্চয় এন্ট্রি আপডেট করতে সমস্যা',
                code: 'UPDATE_ERROR'
            });
        }
    }
);

// ── DELETE: Delete savings entry (Admin only) ──
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

            const entry = db.get('savings').find({ id: req.params.id }).value();

            if (!entry) {
                return res.status(404).json({
                    error: 'সঞ্চয় এন্ট্রি পাওয়া যায়নি',
                    code: 'NOT_FOUND'
                });
            }

            // Soft delete (keep for audit)
            db.get('savings')
                .find({ id: req.params.id })
                .assign({
                    deletedAt: new Date().toISOString(),
                    deletedBy: req.user.id
                })
                .write();

            console.log(`[Savings] Deleted: ${entry.id} by ${req.user.name || req.user.id}`);

            res.json({
                message: 'সঞ্চয় এন্ট্রি মুছে দেওয়া হয়েছে',
                id: req.params.id
            });

        } catch (error) {
            console.error('[Savings] DELETE error:', error);
            res.status(500).json({
                error: 'সঞ্চয় এন্ট্রি মুছতে সমস্যা',
                code: 'DELETE_ERROR'
            });
        }
    }
);

// ── GET: Monthly report ──
router.get('/report/monthly',
    verifyToken,
    requireAdmin,
    [
        query('year').optional().isInt({ min: 2020, max: 2100 }).toInt()
    ],
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const year = req.query.year || new Date().getFullYear();
            const savings = db.get('savings').value();
            const users = db.get('users').filter(u => u.role === 'member').value();

            const months = [];
            let yearTotal = 0;
            let yearLateFees = 0;

            for (let m = 1; m <= 12; m++) {
                const monthKey = `${year}-${String(m).padStart(2, '0')}`;
                const monthSavings = savings.filter(s => s.month === monthKey);

                const total = monthSavings.reduce((sum, s) => sum + (s.amount || 0), 0);
                const lateFees = monthSavings.reduce((sum, s) => sum + (s.lateFee || 0), 0);
                const uniqueUsers = [...new Set(monthSavings.map(s => s.userId))].length;

                yearTotal += total;
                yearLateFees += lateFees;

                months.push({
                    month: monthKey,
                    monthLabel: getMonthLabel(m) + ' ' + year,
                    total,
                    lateFees,
                    count: monthSavings.length,
                    uniqueUsers,
                    missing: users.length - uniqueUsers,
                    perMember: users.length > 0 ? Math.round(total / users.length) : 0
                });
            }

            res.json({
                year,
                months,
                totals: {
                    total: yearTotal,
                    lateFees: yearLateFees,
                    net: yearTotal + yearLateFees,
                    averagePerMonth: yearTotal / 12
                },
                memberCount: users.length
            });

        } catch (error) {
            console.error('[Savings] Monthly report error:', error);
            res.status(500).json({
                error: 'মাসিক রিপোর্ট তৈরি করতে সমস্যা',
                code: 'MONTHLY_REPORT_ERROR'
            });
        }
    }
);

// ── GET: Missing members ──
router.get('/missing/:month',
    verifyToken,
    requireAdmin,
    [
        param('month').isISO8601().withMessage('সঠিক মাস দিন')
    ],
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const { month } = req.params;

            const members = db.get('users').filter(u => u.role === 'member').value();
            const paid = db.get('savings')
                .filter({ month })
                .map(s => s.userId)
                .value();

            const paidMembers = members.filter(m => paid.includes(m.id));
            const missingMembers = members.filter(m => !paid.includes(m.id));

            res.json({
                month,
                paid: paidMembers.map(m => ({
                    id: m.id,
                    name: m.name,
                    phone: m.phone,
                    memberID: m.memberID || '—'
                })),
                missing: missingMembers.map(m => ({
                    id: m.id,
                    name: m.name,
                    phone: m.phone,
                    memberID: m.memberID || '—'
                })),
                stats: {
                    totalMembers: members.length,
                    paidCount: paidMembers.length,
                    missingCount: missingMembers.length,
                    completionRate: members.length > 0 ?
                        Math.round((paidMembers.length / members.length) * 100) :
                        0
                }
            });

        } catch (error) {
            console.error('[Savings] Missing error:', error);
            res.status(500).json({
                error: 'মিসিং সদস্য লোড করতে সমস্যা',
                code: 'MISSING_ERROR'
            });
        }
    }
);

// ── GET: Export CSV ──
router.get('/export/csv',
    verifyToken,
    requireAdmin,
    [
        query('year').optional().isInt({ min: 2020, max: 2100 }).toInt()
    ],
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const year = req.query.year || new Date().getFullYear();
            const savings = db.get('savings')
                .filter(s => s.month?.startsWith(String(year)))
                .value();

            const users = db.get('users').value();

            // CSV Headers
            const headers = ['তারিখ', 'সদস্য', 'মাস', 'পরিমাণ', 'বিলম্ব ফি', 'মন্তব্য'];
            const rows = savings.map(s => {
                const user = users.find(u => u.id === s.userId);
                return [
                    formatDate(s.date) || '—',
                    user?.name || s.userName || '—',
                    s.month || '—',
                    s.amount || 0,
                    s.lateFee || 0,
                    s.note || ''
                ];
            });

            // Sort by date
            rows.sort((a, b) => a[0].localeCompare(b[0]));

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
            ].join('\n');

            const bom = '\uFEFF';
            const finalContent = bom + csvContent;

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition',
                `attachment; filename=savings-${year}-${new Date().toISOString().slice(0, 10)}.csv`
            );
            res.send(finalContent);

        } catch (error) {
            console.error('[Savings] CSV export error:', error);
            res.status(500).json({
                error: 'CSV এক্সপোর্ট করতে সমস্যা',
                code: 'CSV_EXPORT_ERROR'
            });
        }
    }
);

// ── POST: Bulk import savings ──
router.post('/bulk',
    verifyToken,
    requireAdmin,
    [
        body('entries').isArray().withMessage('এন্ট্রি অ্যারে প্রয়োজন')
            .custom(entries => {
                for (const e of entries) {
                    if (!e.userId || !e.month || !e.amount) {
                        throw new Error('প্রতিটি এন্ট্রিতে userId, month, amount প্রয়োজন');
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

            const { entries } = req.body;
            const results = {
                success: [],
                failed: [],
                skipped: []
            };

            for (const e of entries) {
                try {
                    // Check if user exists
                    const user = getUser(e.userId);
                    if (!user) {
                        results.failed.push({ ...e, reason: 'ব্যবহারকারী পাওয়া যায়নি' });
                        continue;
                    }

                    // Check for duplicate
                    if (hasSavingsForMonth(e.userId, e.month)) {
                        results.skipped.push({ ...e, reason: 'ইতিমধ্যে আছে' });
                        continue;
                    }

                    // Create entry
                    const entry = {
                        id: `SAV-${Date.now().toString(36).toUpperCase()}`,
                        userId: e.userId,
                        userName: user.name,
                        userPhone: user.phone,
                        month: e.month,
                        amount: Number(e.amount),
                        note: e.note || '',
                        lateFlag: e.lateFlag || false,
                        lateFee: Number(e.lateFee) || 0,
                        addedBy: req.user.id,
                        date: new Date().toISOString(),
                        createdAt: new Date().toISOString()
                    };

                    db.get('savings').push(entry).write();

                    // Add ledger entry
                    addLedgerEntry({
                        type: 'income',
                        category: 'savings',
                        amount: Number(e.amount),
                        description: `সঞ্চয় জমা (বাল্ক) — ${user.name} (${e.month})`,
                        userId: e.userId,
                        refId: entry.id,
                        addedBy: req.user.id
                    });

                    results.success.push(entry);

                } catch (err) {
                    results.failed.push({ ...e, reason: err.message || 'অজানা ত্রুটি' });
                }
            }

            console.log(`[Savings] Bulk import: ${results.success.length} added, ${results.failed.length} failed, ${results.skipped.length} skipped by ${req.user.name || req.user.id}`);

            res.json({
                message: 'বাল্ক ইম্পোর্ট সম্পন্ন হয়েছে',
                results: {
                    added: results.success.length,
                    failed: results.failed.length,
                    skipped: results.skipped.length,
                    details: results
                }
            });

        } catch (error) {
            console.error('[Savings] Bulk import error:', error);
            res.status(500).json({
                error: 'বাল্ক ইম্পোর্ট করতে সমস্যা',
                code: 'BULK_IMPORT_ERROR'
            });
        }
    }
);

// ── Helper functions ──
function getMonthLabel(month) {
    const labels = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
        'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'
    ];
    return labels[month - 1] || month;
}

function formatDate(iso) {
    if (!iso) return '—';
    try {
        return new Date(iso).toISOString().slice(0, 10);
    } catch {
        return '—';
    }
}

module.exports = router;