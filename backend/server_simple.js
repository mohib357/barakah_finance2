// C:\Project\barakah_finance2\backend\server_simple.js

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS
app.use(cors());

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files - serve from parent directory
app.use(express.static(path.join(__dirname, '../')));
app.use('/style', express.static(path.join(__dirname, '../style')));
app.use('/js', express.static(path.join(__dirname, '../js')));
app.use('/pages', express.static(path.join(__dirname, '../pages')));
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'বারাকাহ ফাইন্যান্স API চলছে',
        timestamp: new Date().toISOString()
    });
});

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../index.html'));
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: 'পাতা পাওয়া যায়নি' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('[ERROR]', err.stack);
    res.status(500).json({ error: 'সার্ভার সমস্যা' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🕌 বারাকাহ ফাইন্যান্স — ব্যাকএন্ড সার্ভার চালু          ║
║                                                           ║
║   📡 URL: http://localhost:${PORT}                        ║
║   📊 API: http://localhost:${PORT}/api/health             ║
║   ⏰ সময়: ${new Date().toISOString()}                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
});

module.exports = app;
