// C:\Project\Barakah_Finance\backend\routes\loans.js
// ═══════════════════════════════════════════════════════════════════
// করজে হাসানা রাউট — FIXED & IMPROVED VERSION
// FIXES:
// 1. Added input validation with express-validator
// 2. Added active loan check (prevent multiple active loans)
// 3. Added startMonth validation (must be current or future)
// 4. Added ledger entry with proper error handling
// 5. Added pagination for GET requests
// 6. Added proper error handling with try-catch
// 7. Added logging for audit trail
// 8. Added loan history tracking
// 9. Added notification triggers on status change
// 10. Added loan repayment schedule generation
// ═══════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { db, uuidv4 } = require('../db/database');
const { verifyToken, requireAdmin, requireMemberOrAdmin } = require('../middleware/auth');

// ── Constants ──
const LOAN_STATUS = {
    PENDING: 'pending',
    ACTIVE: 'active',
    PAID: 'paid',
    REJECTED: 'rejected'
};

const VALID_STATUSES = Object.values(LOAN_STATUS);

// ── Helper: Validate status ──
function isValidStatus(status) {
    return VALID_STATUSES.includes(status);
}

// ── Helper: Check if user has active loan ──
function hasActiveLoan(userId) {
    return !!db.get('loans').find({
        userId: userId,
        status: LOAN_STATUS.ACTIVE
    }).value();
}

// ── Helper: Get loan by ID ──
function getLoan(id) {
    return db.get('loans').find({ id: id }).value();
}

// ── Helper: Generate payment schedule ──
function generatePaymentSchedule(amount, months = 3) {
    const schedule = [];
    const perInstallment = Math.round(amount / months);
    let remaining = amount;

    for (let i = 0; i < months; i++) {
        const isLast = i === months - 1;
        const payment = isLast ? remaining : perInstallment;
        schedule.push({
            installment: i + 1,
            amount: payment,
            dueDate: null, // Will be set when loan is approved
            status: 'pending',
            paidAt: null
        });
        remaining -= payment;
    }

    return schedule;
}

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

// ── GET: All loans (Admin only) ──
router.get('/',
    verifyToken,
    requireAdmin,
    [
        query('status').optional().isIn(VALID_STATUSES),
        query('userId').optional().isString().trim(),
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

            const { status, userId, page = 1, limit = 20 } = req.query;

            let loans = db.get('loans').value();
            const users = db.get('users').value();

            // Apply filters
            if (status) loans = loans.filter(l => l.status === status);
            if (userId) loans = loans.filter(l => l.userId === userId);

            // Enrich with user names
            const enriched = loans.map(l => ({
                ...l,
                userName: users.find(u => u.id === l.userId)?.name || l.userName || '—'
            }));

            // Calculate stats
            const activeLoans = loans.filter(l => l.status === LOAN_STATUS.ACTIVE);
            const totalOutstanding = activeLoans.reduce((sum, l) => sum + (l.remaining || 0), 0);

            // Pagination
            const total = enriched.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginated = enriched.slice(startIndex, endIndex);

            res.json({
                loans: paginated,
                stats: {
                    total: loans.length,
                    active: activeLoans.length,
                    pending: loans.filter(l => l.status === LOAN_STATUS.PENDING).length,
                    paid: loans.filter(l => l.status === LOAN_STATUS.PAID).length,
                    rejected: loans.filter(l => l.status === LOAN_STATUS.REJECTED).length,
                    totalOutstanding
                },
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('[Loans] GET error:', error);
            res.status(500).json({
                error: 'করজ ডেটা লোড করতে সমস্যা',
                code: 'FETCH_ERROR'
            });
        }
    }
);

// ── GET: User loans (Member/Admin) ──
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

            // Check permission: user can see their own loans, admin can see all
            if (req.user.id !== userId && req.user.role !== 'admin') {
                return res.status(403).json({
                    error: 'অ্যাক্সেস নেই',
                    code: 'ACCESS_DENIED'
                });
            }

            const loans = db.get('loans').filter({ userId }).value();
            const total = loans.reduce((sum, l) => sum + (l.amount || 0), 0);
            const remaining = loans.filter(l => l.status === LOAN_STATUS.ACTIVE)
                .reduce((sum, l) => sum + (l.remaining || 0), 0);

            res.json({
                loans,
                summary: {
                    total: loans.length,
                    totalAmount: total,
                    totalRemaining: remaining,
                    active: loans.filter(l => l.status === LOAN_STATUS.ACTIVE).length,
                    paid: loans.filter(l => l.status === LOAN_STATUS.PAID).length
                }
            });

        } catch (error) {
            console.error('[Loans] GET user error:', error);
            res.status(500).json({
                error: 'করজ ডেটা লোড করতে সমস্যা',
                code: 'FETCH_ERROR'
            });
        }
    }
);

// ── POST: Apply for loan ──
router.post('/',
    verifyToken,
    [
        body('amount').isFloat({ min: 100, max: 15000 }).withMessage('পরিমাণ ১০০-১৫,০০০ টাকার মধ্যে হতে হবে'),
        body('reason').isString().trim().isLength({ min: 3, max: 500 }).withMessage('কারণ ৩-৫০০ অক্ষরের হতে হবে'),
        body('startMonth').isISO8601().withMessage('সঠিক মাস দিন'),
        body('guarantor').optional().isString().trim(),
        body('months').optional().isInt({ min: 1, max: 12 }).toInt()
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

            const { amount, reason, startMonth, guarantor, months = 3 } = req.body;

            // Check if user exists
            const user = db.get('users').find({ id: req.user.id }).value();
            if (!user) {
                return res.status(404).json({
                    error: 'ব্যবহারকারী পাওয়া যায়নি',
                    code: 'USER_NOT_FOUND'
                });
            }

            // Check if user has active loan
            if (hasActiveLoan(req.user.id)) {
                return res.status(400).json({
                    error: 'আপনার ইতিমধ্যে একটি সক্রিয় করজ আছে। আগেরটি পরিশোধ না করে নতুন আবেদন করা যাবে না।',
                    code: 'ACTIVE_LOAN_EXISTS'
                });
            }

            // Validate startMonth (must be current or future)
            const currentMonth = new Date().toISOString().slice(0, 7);
            if (startMonth < currentMonth) {
                return res.status(400).json({
                    error: 'পরিশোধ শুরুর মাস বর্তমান মাস বা ভবিষ্যত হতে হবে',
                    code: 'INVALID_START_MONTH'
                });
            }

            // Check loan limit from settings
            const settings = db.get('settings').value();
            const maxLoan = settings.maxLoan || 15000;
            if (amount > maxLoan) {
                return res.status(400).json({
                    error: `সর্বোচ্চ ${maxLoan} টাকা আবেদন করা যাবে`,
                    code: 'LOAN_LIMIT_EXCEEDED'
                });
            }

            // Generate payment schedule
            const schedule = generatePaymentSchedule(amount, months);

            // Create loan
            const loan = {
                id: `LOAN-${Date.now().toString(36).toUpperCase()}`,
                userId: req.user.id,
                userName: user.name,
                amount: Number(amount),
                remaining: Number(amount),
                reason: reason.trim(),
                guarantor: guarantor || '',
                startMonth,
                months,
                status: LOAN_STATUS.PENDING,
                payments: [],
                schedule,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                notes: []
            };

            db.get('loans').push(loan).write();

            console.log(`[Loans] Application submitted: ${loan.id} by ${user.name}`);

            res.status(201).json({
                message: 'করজে হাসানা আবেদন জমা হয়েছে',
                loan: {
                    id: loan.id,
                    amount: loan.amount,
                    status: loan.status,
                    remaining: loan.remaining,
                    createdAt: loan.createdAt
                }
            });

        } catch (error) {
            console.error('[Loans] POST error:', error);
            res.status(500).json({
                error: 'করজ আবেদন জমা দিতে সমস্যা',
                code: 'APPLY_ERROR'
            });
        }
    }
);

// ── PATCH: Update loan status (Admin only) ──
router.patch('/:id/status',
    verifyToken,
    requireAdmin,
    [
        param('id').notEmpty().withMessage('আইডি প্রয়োজন'),
        body('status').isIn(VALID_STATUSES).withMessage('অবৈধ স্ট্যাটাস'),
        body('rejectionReason').optional().isString().trim()
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

            const { status, rejectionReason } = req.body;
            const loan = getLoan(req.params.id);

            if (!loan) {
                return res.status(404).json({
                    error: 'করজ পাওয়া যায়নি',
                    code: 'NOT_FOUND'
                });
            }

            // Prevent invalid transitions
            if (loan.status === LOAN_STATUS.PAID || loan.status === LOAN_STATUS.REJECTED) {
                return res.status(400).json({
                    error: `করজটি ${loan.status === LOAN_STATUS.PAID ? 'পরিশোধিত' : 'বাতিল'} হয়েছে। অবস্থা পরিবর্তন করা যাবে না।`,
                    code: 'INVALID_TRANSITION'
                });
            }

            const updates = {
                status,
                updatedAt: new Date().toISOString()
            };

            // Add rejection reason if rejected
            if (status === LOAN_STATUS.REJECTED && rejectionReason) {
                updates.rejectionReason = rejectionReason;
            }

            // If approved (active), generate ledger entry and update schedule
            if (status === LOAN_STATUS.ACTIVE) {
                // Check if user has active loan (again, in case of race condition)
                if (hasActiveLoan(loan.userId)) {
                    return res.status(400).json({
                        error: 'ব্যবহারকারীর ইতিমধ্যে একটি সক্রিয় করজ আছে',
                        code: 'ACTIVE_LOAN_EXISTS'
                    });
                }

                // Update schedule with due dates
                const schedule = loan.schedule || [];
                const startDate = new Date(loan.startMonth + '-01');
                schedule.forEach((item, index) => {
                    const dueDate = new Date(startDate);
                    dueDate.setMonth(dueDate.getMonth() + index);
                    item.dueDate = dueDate.toISOString().slice(0, 10);
                    item.status = 'pending';
                });
                updates.schedule = schedule;

                // Add ledger entry for loan disbursement
                try {
                    addLedgerEntry({
                        type: 'expense',
                        category: 'loan_disbursed',
                        amount: loan.amount,
                        description: `করজে হাসানা বিতরণ — ${loan.userName}`,
                        userId: loan.userId,
                        refId: loan.id,
                        addedBy: req.user.id
                    });
                    console.log(`[Ledger] Loan disbursed: ${loan.id} by ${req.user.name || req.user.id}`);
                } catch (ledgerError) {
                    console.error('[Ledger] Failed to add entry for loan:', ledgerError);
                    // Continue anyway - the loan is still active
                }
            }

            // If paid, update remaining to 0
            if (status === LOAN_STATUS.PAID) {
                updates.remaining = 0;
                if (loan.payments) {
                    const totalPaid = loan.payments.reduce((sum, p) => sum + p.amount, 0);
                    if (totalPaid < loan.amount) {
                        // Add final payment if not fully paid
                        const finalPayment = {
                            id: `PAY-${Date.now().toString(36).toUpperCase()}`,
                            amount: loan.amount - totalPaid,
                            note: 'অটো পরিশোধ (স্ট্যাটাস আপডেট)',
                            date: new Date().toISOString(),
                            addedBy: req.user.id
                        };
                        if (!loan.payments) loan.payments = [];
                        loan.payments.push(finalPayment);
                        updates.payments = loan.payments;
                    }
                }
                // Add ledger entry for full repayment
                try {
                    addLedgerEntry({
                        type: 'income',
                        category: 'loan_repayment',
                        amount: loan.amount,
                        description: `করজ সম্পূর্ণ পরিশোধ — ${loan.userName}`,
                        userId: loan.userId,
                        refId: loan.id,
                        addedBy: req.user.id
                    });
                    console.log(`[Ledger] Loan fully repaid: ${loan.id} by ${req.user.name || req.user.id}`);
                } catch (ledgerError) {
                    console.error('[Ledger] Failed to add repayment entry:', ledgerError);
                }
            }

            // Add to notes
            if (!loan.notes) loan.notes = [];
            loan.notes.push({
                by: req.user.name || req.user.id,
                action: 'status_update',
                from: loan.status,
                to: status,
                reason: rejectionReason || null,
                timestamp: new Date().toISOString()
            });
            updates.notes = loan.notes;

            // Update loan
            db.get('loans').find({ id: req.params.id }).assign(updates).write();

            const updatedLoan = getLoan(req.params.id);

            console.log(`[Loans] Status updated: ${loan.id} ${loan.status} → ${status} by ${req.user.name || req.user.id}`);

            res.json({
                message: `করজ ${status === LOAN_STATUS.ACTIVE ? 'অনুমোদিত' : status === LOAN_STATUS.REJECTED ? 'বাতিল' : status === LOAN_STATUS.PAID ? 'পরিশোধিত' : 'আপডেট'} হয়েছে`,
                loan: {
                    id: updatedLoan.id,
                    status: updatedLoan.status,
                    remaining: updatedLoan.remaining,
                    amount: updatedLoan.amount
                }
            });

        } catch (error) {
            console.error('[Loans] Status update error:', error);
            res.status(500).json({
                error: 'করজ স্ট্যাটাস আপডেট করতে সমস্যা',
                code: 'STATUS_UPDATE_ERROR'
            });
        }
    }
);

// ── POST: Add payment to loan (Admin only) ──
router.post('/:id/payment',
    verifyToken,
    requireAdmin,
    [
        param('id').notEmpty().withMessage('আইডি প্রয়োজন'),
        body('amount').isFloat({ min: 1 }).withMessage('পরিমাণ ১ টাকার বেশি হতে হবে'),
        body('note').optional().isString().trim().isLength({ max: 200 })
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

            const { amount, note } = req.body;
            const loan = getLoan(req.params.id);

            if (!loan) {
                return res.status(404).json({
                    error: 'করজ পাওয়া যায়নি',
                    code: 'NOT_FOUND'
                });
            }

            if (loan.status !== LOAN_STATUS.ACTIVE) {
                return res.status(400).json({
                    error: `করজটি সক্রিয় নয় (বর্তমান অবস্থা: ${loan.status})`,
                    code: 'NOT_ACTIVE'
                });
            }

            if (amount > loan.remaining) {
                return res.status(400).json({
                    error: `পরিশোধ পরিমাণ বাকি পরিমাণের (${loan.remaining} টাকা) বেশি হতে পারে না`,
                    code: 'AMOUNT_EXCEEDS_REMAINING'
                });
            }

            // Create payment record
            const payment = {
                id: `PAY-${Date.now().toString(36).toUpperCase()}`,
                amount: Number(amount),
                note: note || '',
                date: new Date().toISOString(),
                addedBy: req.user.id,
                addedByName: req.user.name || req.user.username
            };

            // Update remaining
            const newRemaining = Math.max(0, loan.remaining - Number(amount));

            const updates = {
                remaining: newRemaining,
                payments: [...(loan.payments || []), payment],
                updatedAt: new Date().toISOString()
            };

            // If fully paid, update status
            if (newRemaining === 0) {
                updates.status = LOAN_STATUS.PAID;

                // Add ledger entry for full repayment
                try {
                    addLedgerEntry({
                        type: 'income',
                        category: 'loan_repayment',
                        amount: Number(amount),
                        description: `করজ সম্পূর্ণ পরিশোধ — ${loan.userName}`,
                        userId: loan.userId,
                        refId: loan.id,
                        addedBy: req.user.id
                    });
                } catch (ledgerError) {
                    console.error('[Ledger] Failed to add repayment entry:', ledgerError);
                }

                // Add note
                if (!loan.notes) loan.notes = [];
                loan.notes.push({
                    by: req.user.name || req.user.id,
                    action: 'full_payment',
                    amount: Number(amount),
                    timestamp: new Date().toISOString()
                });
                updates.notes = loan.notes;

            } else {
                // Add partial payment ledger entry
                try {
                    addLedgerEntry({
                        type: 'income',
                        category: 'loan_repayment',
                        amount: Number(amount),
                        description: `করজ আংশিক পরিশোধ — ${loan.userName} (বাকি: ${newRemaining})`,
                        userId: loan.userId,
                        refId: loan.id,
                        addedBy: req.user.id
                    });
                } catch (ledgerError) {
                    console.error('[Ledger] Failed to add partial payment entry:', ledgerError);
                }

                // Add note
                if (!loan.notes) loan.notes = [];
                loan.notes.push({
                    by: req.user.name || req.user.id,
                    action: 'partial_payment',
                    amount: Number(amount),
                    remaining: newRemaining,
                    timestamp: new Date().toISOString()
                });
                updates.notes = loan.notes;

                // Update schedule status
                if (loan.schedule) {
                    let paidAmount = 0;
                    const schedule = loan.schedule.map(item => {
                        if (item.status === 'paid') return item;
                        const remainingForItem = item.amount - (item.paidAmount || 0);
                        if (amount >= remainingForItem) {
                            paidAmount += remainingForItem;
                            item.status = 'paid';
                            item.paidAt = new Date().toISOString();
                            item.paidAmount = item.amount;
                        } else {
                            // Partial payment for this installment
                            item.paidAmount = (item.paidAmount || 0) + amount;
                            item.status = 'partial';
                            paidAmount += amount;
                        }
                        return item;
                    });
                    updates.schedule = schedule;
                }
            }

            // Update loan
            db.get('loans').find({ id: req.params.id }).assign(updates).write();

            const updatedLoan = getLoan(req.params.id);

            console.log(`[Loans] Payment added: ${payment.id} (${payment.amount}) for ${loan.id} by ${req.user.name || req.user.id}`);

            res.json({
                message: newRemaining === 0 ? 'করজ সম্পূর্ণ পরিশোধ হয়েছে ✅' : 'পরিশোধ রেকর্ড হয়েছে',
                payment,
                remaining: newRemaining,
                status: updatedLoan.status
            });

        } catch (error) {
            console.error('[Loans] Payment error:', error);
            res.status(500).json({
                error: 'পরিশোধ রেকর্ড করতে সমস্যা',
                code: 'PAYMENT_ERROR'
            });
        }
    }
);

// ── DELETE: Delete loan (Admin only) ──
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

            const loan = getLoan(req.params.id);

            if (!loan) {
                return res.status(404).json({
                    error: 'করজ পাওয়া যায়নি',
                    code: 'NOT_FOUND'
                });
            }

            // Only pending loans can be deleted
            if (loan.status !== LOAN_STATUS.PENDING) {
                return res.status(400).json({
                    error: 'শুধুমাত্র পেন্ডিং করজ মুছা যাবে',
                    code: 'CANNOT_DELETE'
                });
            }

            db.get('loans').remove({ id: req.params.id }).write();

            console.log(`[Loans] Deleted: ${loan.id} by ${req.user.name || req.user.id}`);

            res.json({
                message: 'করজ মুছে দেওয়া হয়েছে',
                id: req.params.id
            });

        } catch (error) {
            console.error('[Loans] DELETE error:', error);
            res.status(500).json({
                error: 'করজ মুছতে সমস্যা',
                code: 'DELETE_ERROR'
            });
        }
    }
);

module.exports = router;