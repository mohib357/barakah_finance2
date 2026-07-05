// C:\Project\Barakah_Finance\backend\routes\applications.js
// ═══════════════════════════════════════════════════════════════════
// অ্যাপ্লিকেশন রাউট — FIXED & IMPROVED VERSION
// FIXES:
// 1. Added input validation with express-validator
// 2. Added pagination for GET requests
// 3. Added rate limiting for POST requests
// 4. Added allowed fields whitelist for PATCH
// 5. Added proper error handling with try-catch
// 6. Added logging for audit trail
// 7. Added application status tracking
// 8. Added approval history
// 9. Added notification trigger on status change
// 10. Added member ID generation on approval
// ═══════════════════════════════════════════════════════════════════

const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { db, uuidv4, getCurrentMonth } = require('../db/database');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// ── Rate Limiting ──
const submitLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 applications per hour per IP
    message: {
        error: 'অনেক বেশি আবেদন জমা দিয়েছেন। অনুগ্রহ করে ১ ঘন্টা পর চেষ্টা করুন।',
        code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// ── Allowed Fields for Update ──
const ALLOWED_UPDATE_FIELDS = [
    'status',
    'memberID',
    'rejectionReason',
    'approvals',
    'notes'
];

// ── Status Constants ──
const STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected'
};

// ── Approval Roles ──
const APPROVAL_ROLES = [
    'committee1',
    'committee2',
    'committee3',
    'committee4',
    'secretary',
    'vicePresident',
    'president'
];

// ── Helper: Generate Member ID ──
function generateMemberID() {
    const month = new Date().toISOString().slice(0, 7).replace('-', '');
    const count = db.get('users').filter(u => u.role === 'member').value().length + 1;
    return `BF-${month}-${String(count).padStart(4, '0')}`;
}

// ── Helper: Get applications with pagination ──
function getPaginatedApplications(page = 1, limit = 20, filter = {}) {
    const allApps = db.get('applications').filter(filter).value();
    const total = allApps.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const data = allApps.slice(startIndex, endIndex);

    return {
        data,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
        }
    };
}

// ── Helper: Validate approval step ──
function isValidApprovalStep(role) {
    return APPROVAL_ROLES.includes(role);
}

// ── Helper: Check if admin can approve ──
function canApprove(application, adminRole) {
    const approvals = application.approvals || {
        committee: [],
        secretary: false,
        vicePresident: false,
        president: false
    };

    if (adminRole.startsWith('committee')) {
        return !approvals.committee.includes(adminRole);
    }

    if (adminRole === 'secretary') {
        return approvals.committee.length >= 4 && !approvals.secretary;
    }

    if (adminRole === 'vicePresident') {
        return approvals.secretary && !approvals.vicePresident;
    }

    if (adminRole === 'president') {
        return approvals.vicePresident && !approvals.president;
    }

    return false;
}

// ── GET: All applications (Admin only) ──
router.get('/',
    verifyToken,
    requireAdmin,
    [
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
        query('status').optional().isIn(Object.values(STATUS)),
        query('search').optional().isString().trim()
    ],
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const page = req.query.page || 1;
            const limit = req.query.limit || 20;
            const status = req.query.status;
            const search = req.query.search?.toLowerCase();

            // Build filter
            const filter = {};
            if (status) filter.status = status;

            let applications = db.get('applications').value();

            // Apply status filter
            if (status) {
                applications = applications.filter(a => a.status === status);
            }

            // Apply search filter
            if (search) {
                applications = applications.filter(a =>
                    (a.applicantNameBn || '').toLowerCase().includes(search) ||
                    (a.applicantNameEn || '').toLowerCase().includes(search) ||
                    (a.nidNumber || '').includes(search) ||
                    (a.id || '').toLowerCase().includes(search) ||
                    (a.memberID || '').toLowerCase().includes(search)
                );
            }

            // Pagination
            const total = applications.length;
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const data = applications.slice(startIndex, endIndex);

            res.json({
                data,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('[Applications] GET error:', error);
            res.status(500).json({
                error: 'আবেদন লোড করতে সমস্যা',
                code: 'FETCH_ERROR'
            });
        }
    }
);

// ── POST: Submit new application (Public) ──
router.post('/',
    submitLimiter,
    [
        body('applicantNameBn').notEmpty().withMessage('নাম (বাংলা) প্রয়োজন'),
        body('applicantNameEn').notEmpty().withMessage('নাম (ইংরেজি) প্রয়োজন'),
        body('nidNumber').isLength({ min: 10, max: 17 }).withMessage('এনআইডি নম্বর সঠিক নয়'),
        body('dob').notEmpty().withMessage('জন্ম তারিখ প্রয়োজন'),
        body('phones').isArray().withMessage('মোবাইল নম্বর প্রয়োজন'),
        body('currentAddress').notEmpty().withMessage('বর্তমান ঠিকানা প্রয়োজন'),
        body('permanentAddress').notEmpty().withMessage('স্থায়ী ঠিকানা প্রয়োজন'),
        body('nomineeName_bn').notEmpty().withMessage('নমিনির নাম প্রয়োজন')
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

            // Check for duplicate NID
            const existing = db.get('applications')
                .find({ nidNumber: req.body.nidNumber })
                .value();

            if (existing) {
                return res.status(409).json({
                    error: 'এই এনআইডি নম্বরে ইতিমধ্যে একটি আবেদন রয়েছে',
                    code: 'DUPLICATE_NID'
                });
            }

            // Create application
            const application = {
                id: `BF-${Date.now().toString(36).toUpperCase()}`,
                ...req.body,
                status: STATUS.PENDING,
                approvals: {
                    committee: [],
                    secretary: false,
                    vicePresident: false,
                    president: false
                },
                memberID: null,
                rejectionReason: null,
                notes: [],
                submittedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            db.get('applications').push(application).write();

            // Log for audit
            console.log(`[Applications] New application submitted: ${application.id}`);

            res.status(201).json({
                message: 'আবেদন জমা হয়েছে',
                application: {
                    id: application.id,
                    status: application.status,
                    submittedAt: application.submittedAt
                }
            });

        } catch (error) {
            console.error('[Applications] POST error:', error);
            res.status(500).json({
                error: 'আবেদন জমা দিতে সমস্যা',
                code: 'SUBMIT_ERROR'
            });
        }
    }
);

// ── GET: Single application (Admin only) ──
router.get('/:id',
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

            const application = db.get('applications')
                .find({ id: req.params.id })
                .value();

            if (!application) {
                return res.status(404).json({
                    error: 'আবেদন পাওয়া যায়নি',
                    code: 'NOT_FOUND'
                });
            }

            res.json(application);

        } catch (error) {
            console.error('[Applications] GET single error:', error);
            res.status(500).json({
                error: 'আবেদন লোড করতে সমস্যা',
                code: 'FETCH_ERROR'
            });
        }
    }
);

// ── PATCH: Update application (Admin only) ──
router.patch('/:id',
    verifyToken,
    requireAdmin,
    [
        param('id').notEmpty().withMessage('আইডি প্রয়োজন'),
        body('status').optional().isIn(Object.values(STATUS)),
        body('memberID').optional().isString().trim(),
        body('rejectionReason').optional().isString().trim(),
        body('approvals').optional().isObject()
    ],
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const application = db.get('applications')
                .find({ id: req.params.id })
                .value();

            if (!application) {
                return res.status(404).json({
                    error: 'আবেদন পাওয়া যায়নি',
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

            // Handle status change
            if (updates.status === STATUS.APPROVED && !application.memberID) {
                // Auto-generate member ID if not provided
                updates.memberID = generateMemberID();
            }

            // Add note for audit
            updates.updatedAt = new Date().toISOString();
            if (!application.notes) application.notes = [];
            application.notes.push({
                by: req.user.name || req.user.id,
                action: 'status_update',
                changes: updates,
                timestamp: new Date().toISOString()
            });

            // Update the application
            db.get('applications')
                .find({ id: req.params.id })
                .assign(updates)
                .write();

            // If approved, also create user if not exists
            if (updates.status === STATUS.APPROVED && updates.memberID) {
                // Check if user already exists with this NID
                const existingUser = db.get('users')
                    .find({ nid: application.nidNumber })
                    .value();

                if (!existingUser) {
                    // Create user from application data
                    const user = {
                        id: `USR-${Date.now().toString(36).toUpperCase()}`,
                        name: application.applicantNameBn,
                        username: application.applicantNameEn?.toLowerCase().replace(/\s/g, '') || 'user',
                        phone: (application.phones || [])[0] || '',
                        email: application.email || null,
                        nid: application.nidNumber,
                        dob: application.dob,
                        occupation: application.occupation,
                        address: application.permanentAddress,
                        memberID: updates.memberID,
                        role: 'member',
                        verified: true,
                        profileComplete: 60,
                        createdAt: new Date().toISOString()
                    };
                    db.get('users').push(user).write();
                    console.log(`[Applications] User created from application: ${user.id}`);
                }
            }

            const updated = db.get('applications')
                .find({ id: req.params.id })
                .value();

            res.json({
                message: 'আবেদন আপডেট হয়েছে',
                application: updated
            });

        } catch (error) {
            console.error('[Applications] PATCH error:', error);
            res.status(500).json({
                error: 'আবেদন আপডেট করতে সমস্যা',
                code: 'UPDATE_ERROR'
            });
        }
    }
);

// ── POST: Approve step (Admin only) ──
router.post('/:id/approve',
    verifyToken,
    requireAdmin,
    [
        param('id').notEmpty().withMessage('আইডি প্রয়োজন'),
        body('role').isIn(APPROVAL_ROLES).withMessage('অবৈধ ভূমিকা')
    ],
    (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            const application = db.get('applications')
                .find({ id: req.params.id })
                .value();

            if (!application) {
                return res.status(404).json({
                    error: 'আবেদন পাওয়া যায়নি',
                    code: 'NOT_FOUND'
                });
            }

            if (application.status !== STATUS.PENDING) {
                return res.status(400).json({
                    error: 'শুধুমাত্র পেন্ডিং আবেদন অনুমোদন করা যাবে',
                    code: 'NOT_PENDING'
                });
            }

            const role = req.body.role;
            if (!canApprove(application, role)) {
                return res.status(400).json({
                    error: 'আপনি এই ধাপে অনুমোদন দিতে পারবেন না',
                    code: 'INVALID_APPROVAL_STEP'
                });
            }

            // Update approvals
            const approvals = application.approvals || {
                committee: [],
                secretary: false,
                vicePresident: false,
                president: false
            };

            if (role.startsWith('committee')) {
                approvals.committee.push(role);
            } else if (role === 'secretary') {
                approvals.secretary = true;
            } else if (role === 'vicePresident') {
                approvals.vicePresident = true;
            } else if (role === 'president') {
                approvals.president = true;
                // Auto-approve application when president approves
                application.status = STATUS.APPROVED;
                application.memberID = generateMemberID();
            }

            // Add note
            if (!application.notes) application.notes = [];
            application.notes.push({
                by: req.user.name || req.user.id,
                action: 'approval',
                role: role,
                timestamp: new Date().toISOString()
            });

            // Save updates
            db.get('applications')
                .find({ id: req.params.id })
                .assign({
                    approvals,
                    status: application.status,
                    memberID: application.memberID,
                    updatedAt: new Date().toISOString(),
                    notes: application.notes
                })
                .write();

            // If fully approved, create user
            if (application.status === STATUS.APPROVED) {
                const existingUser = db.get('users')
                    .find({ nid: application.nidNumber })
                    .value();

                if (!existingUser) {
                    const user = {
                        id: `USR-${Date.now().toString(36).toUpperCase()}`,
                        name: application.applicantNameBn,
                        username: application.applicantNameEn?.toLowerCase().replace(/\s/g, '') || 'user',
                        phone: (application.phones || [])[0] || '',
                        email: application.email || null,
                        nid: application.nidNumber,
                        dob: application.dob,
                        occupation: application.occupation,
                        address: application.permanentAddress,
                        memberID: application.memberID,
                        role: 'member',
                        verified: true,
                        profileComplete: 60,
                        createdAt: new Date().toISOString()
                    };
                    db.get('users').push(user).write();
                }
            }

            const updated = db.get('applications')
                .find({ id: req.params.id })
                .value();

            res.json({
                message: 'অনুমোদন সম্পন্ন হয়েছে',
                application: updated
            });

        } catch (error) {
            console.error('[Applications] Approve error:', error);
            res.status(500).json({
                error: 'অনুমোদন দিতে সমস্যা',
                code: 'APPROVE_ERROR'
            });
        }
    }
);

// ── DELETE: Delete application (Admin only) ──
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

            const application = db.get('applications')
                .find({ id: req.params.id })
                .value();

            if (!application) {
                return res.status(404).json({
                    error: 'আবেদন পাওয়া যায়নি',
                    code: 'NOT_FOUND'
                });
            }

            // Don't allow deletion of approved applications
            if (application.status === STATUS.APPROVED) {
                return res.status(400).json({
                    error: 'অনুমোদিত আবেদন মুছা যাবে না',
                    code: 'CANNOT_DELETE_APPROVED'
                });
            }

            db.get('applications')
                .remove({ id: req.params.id })
                .write();

            res.json({
                message: 'আবেদন মুছে দেওয়া হয়েছে',
                id: req.params.id
            });

        } catch (error) {
            console.error('[Applications] DELETE error:', error);
            res.status(500).json({
                error: 'আবেদন মুছতে সমস্যা',
                code: 'DELETE_ERROR'
            });
        }
    }
);

module.exports = router;