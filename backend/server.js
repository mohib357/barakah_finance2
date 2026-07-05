// C:\Project\Barakah_Finance\backend\server.js
// ═══════════════════════════════════════════════════════════════════
// বারাকাহ ফাইন্যান্স — Node.js ব্যাকএন্ড সার্ভার (FIXED & IMPROVED)
// FIXES:
// 1. Added environment-based CORS configuration (no more wildcard *)
// 2. Added Helmet for security headers
// 3. Added rate limiting to prevent abuse
// 4. Added proper error handling middleware
// 5. Added request logging (morgan)
// 6. Added environment-aware configuration
// 7. Added graceful shutdown handling
// 8. Added health check with detailed status
// 9. Fixed static file serving path
// 10. Added compression for better performance
// ═══════════════════════════════════════════════════════════════════

const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';

// ── Allowed Origins ──
const allowedOrigins = isProduction
    ? [
        'https://barakah-finance.com',
        'https://www.barakah-finance.com',
        'https://barakah-finance.vercel.app',
        'https://barakah-finance.netlify.app'
    ]
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5500',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:5500'
    ];

// ── Security: CORS ──
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || !isProduction) {
            callback(null, true);
        } else {
            callback(new Error('CORS policy violation: Origin not allowed'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// ── Security: Helmet (sets various HTTP headers) ──
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://cdn.tailwindcss.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "http://localhost:3001"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ── Rate Limiting ──
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'অনেক বেশি রিকোয়েস্ট, অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন।',
        retryAfter: 900
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: function (req) {
        // Skip rate limiting for health check in production
        return req.path === '/api/health';
    }
});

// Apply rate limiting to API routes
app.use('/api/', limiter);

// ── Logging ──
if (isProduction) {
    app.use(morgan('combined'));
} else {
    app.use(morgan('dev'));
}

// ── Compression ──
app.use(compression());

// ── Body Parsers ──
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Static Files ──
// Serve frontend files from the project root
app.use(express.static(path.join(__dirname, '../')));
// Serve specific folders for better organization
app.use('/style', express.static(path.join(__dirname, '../style')));
app.use('/js', express.static(path.join(__dirname, '../js')));
app.use('/pages', express.static(path.join(__dirname, '../pages')));
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// ── Routes ──
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const savingsRoutes = require('./routes/savings');
const loansRoutes = require('./routes/loans');
const ordersRoutes = require('./routes/orders');
const productsRoutes = require('./routes/products');
const noticesRoutes = require('./routes/notices');
const badgesRoutes = require('./routes/badges');
const applicationsRoutes = require('./routes/applications');
const ledgerRoutes = require('./routes/ledger');
const reportsRoutes = require('./routes/reports');

// ── API Routes ──
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/savings', savingsRoutes);
app.use('/api/loans', loansRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/notices', noticesRoutes);
app.use('/api/badges', badgesRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/ledger', ledgerRoutes);
app.use('/api/reports', reportsRoutes);

// ── Health Check ──
app.get('/api/health', (req, res) => {
    const health = {
        status: 'ok',
        message: 'বারাকাহ ফাইন্যান্স API চলছে',
        timestamp: new Date().toISOString(),
        environment: NODE_ENV,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
    };
    res.json(health);
});

// ── Root ──
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// ── 404 Handler ──
app.use((req, res) => {
    // Check if the request accepts JSON
    if (req.accepts('json')) {
        res.status(404).json({ error: 'পাতা পাওয়া যায়নি' });
    } else {
        res.status(404).sendFile(path.join(__dirname, '../404.html'));
    }
});

// ── Global Error Handler ──
app.use((err, req, res, next) => {
    console.error('[ERROR]', err.stack);

    // Handle specific error types
    if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
        return res.status(401).json({ error: 'অননুমোদিত অ্যাক্সেস' });
    }

    if (err.name === 'ValidationError') {
        return res.status(400).json({ error: err.message || 'ভুল ডেটা' });
    }

    // Default error response
    const status = err.status || 500;
    const message = isProduction
        ? 'সার্ভার সমস্যা। অনুগ্রহ করে পরে আবার চেষ্টা করুন।'
        : err.message || 'অজানা ত্রুটি';

    res.status(status).json({
        error: message,
        ...(isProduction ? {} : { stack: err.stack })
    });
});

// ── Graceful Shutdown ──
let server = null;

function gracefulShutdown(signal) {
    console.log(`\n📡 ${signal} সংকেত পেয়েছি। সার্ভার বন্ধ হচ্ছে...`);

    if (server) {
        server.close(() => {
            console.log('✅ HTTP সার্ভার বন্ধ হয়েছে।');
            process.exit(0);
        });

        // Force close after 10 seconds
        setTimeout(() => {
            console.error('⚠️ টাইমআউট: ফোর্স শাটডাউন।');
            process.exit(1);
        }, 10000);
    } else {
        process.exit(0);
    }
}

// Listen for shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    if (isProduction) {
        gracefulShutdown('uncaughtException');
    } else {
        // In development, keep running but log the error
        console.error('Uncaught Exception (development):', error);
    }
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    if (isProduction) {
        gracefulShutdown('unhandledRejection');
    }
});

// ── Start Server ──
server = app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🕌 বারাকাহ ফাইন্যান্স — ব্যাকএন্ড সার্ভার চালু                  ║
║                                                           ║
║   📡 URL: http://localhost:${PORT}                        ║
║   📊 API: http://localhost:${PORT}/api/health             ║
║   🌍 পরিবেশ: ${NODE_ENV}                                 ║
║   ⏰ সময়: ${new Date().toISOString()}                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
});

module.exports = { app, server };