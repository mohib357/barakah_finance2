// C:\Project\barakah_finance2\backend\services\email.js

const resend = require('resend');
require('dotenv').config();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'onboarding@resend.dev';

// Initialize Resend
resend.api_key = RESEND_API_KEY;

/**
 * Send OTP email to user
 * @param {string} recipientEmail - Recipient email address
 * @param {string} otp - OTP code
 * @param {string} userName - User's name
 * @returns {Promise<object>} - Email send result
 */
async function sendOTPEmail(recipientEmail, otp, userName = 'ব্যবহারকারী') {
    const subject = 'বারাকাহ ফাইন্যান্স - আপনার OTP কোড';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Noto Sans Bengali', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 10px; }
        .header { text-align: center; padding: 20px 0; border-bottom: 2px solid #064E3B; }
        .header h1 { color: #064E3B; margin: 0; font-size: 28px; }
        .content { padding: 30px 0; text-align: center; }
        .otp-box { background-color: #F0FDF4; border: 2px dashed #064E3B; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .otp-code { font-size: 36px; font-weight: bold; color: #064E3B; letter-spacing: 8px; margin: 10px 0; }
        .footer { text-align: center; padding: 20px 0; border-top: 1px solid #e5e5e5; color: #888; font-size: 14px; }
        .warning { color: #DC2626; font-size: 12px; margin-top: 15px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🕌 বারাকাহ ফাইন্যান্স</h1>
            <p>সুদমুক্ত লেনদেনে সমৃদ্ধি সবার</p>
        </div>
        
        <div class="content">
            <h2>আসসালামু আলাইকুম, ${userName}!</h2>
            <p>আপনার অ্যাকাউন্ট যাচাই করতে নিচের OTP কোড ব্যবহার করুন:</p>
            
            <div class="otp-box">
                <p style="margin: 0; color: #064E3B;">আপনার OTP কোড</p>
                <div class="otp-code">${otp}</div>
                <p style="margin: 0; font-size: 14px; color: #666;">এই কোডটি ৫ মিনিটের জন্য বৈধ</p>
            </div>
            
            <p>আপনি যদি এই অ্যাকাউন্ট তৈরি না করে থাকেন, তাহলে এই ইমেইলটি উপেক্ষা করুন।</p>
            
            <p class="warning">
                ⚠️ নিরাপত্তার জন্য, এই OTP কোড কাউকে শেয়ার করবেন না।
            </p>
        </div>
        
        <div class="footer">
            <p>© ২০২৬ বারাকাহ ফাইন্যান্স। সর্বস্বত্ব সংরক্ষিত।</p>
            <p>এটি একটি স্বয়ংক্রিয় ইমেইল। অনুগ্রহ করে উত্তর দেবেন না।</p>
        </div>
    </div>
</body>
</html>
    `;

    try {
        const params = {
            from: SENDER_EMAIL,
            to: [recipientEmail],
            subject: subject,
            html: htmlContent
        };

        const email = await resend.emails.send(params);

        return {
            success: true,
            emailId: email.id,
            message: 'Email sent successfully'
        };
    } catch (error) {
        console.error('Email send error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Send welcome email to new user
 * @param {string} recipientEmail - Recipient email address
 * @param {string} userName - User's name
 * @returns {Promise<object>} - Email send result
 */
async function sendWelcomeEmail(recipientEmail, userName) {
    const subject = 'বারাকাহ ফাইন্যান্সে স্বাগতম! 🕌';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Noto Sans Bengali', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 10px; }
        .header { text-align: center; padding: 20px 0; }
        .header h1 { color: #064E3B; margin: 0; font-size: 32px; }
        .content { padding: 20px 0; }
        .button { display: inline-block; padding: 12px 30px; background-color: #064E3B; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px 0; border-top: 1px solid #e5e5e5; color: #888; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🕌 বারাকাহ ফাইন্যান্স</h1>
        </div>
        
        <div class="content">
            <h2>আসসালামু আলাইকুম, ${userName}!</h2>
            <p>বারাকাহ ফাইন্যান্সে আপনাকে স্বাগতম! আপনার অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে।</p>
            
            <p>আমরা একটি সুদমুক্ত আর্থিক প্রতিষ্ঠান যা শরীয়াহ-সম্মত লেনদেন নিশ্চিত করে।</p>
            
            <h3>আপনি যা করতে পারেন:</h3>
            <ul>
                <li>💰 সঞ্চয় অ্যাকাউন্ট খুলুন</li>
                <li>🤝 করজে হাসানা (সুদমুক্ত ঋণ) আবেদন করুন</li>
                <li>🛍️ পণ্য ক্রয়ে কিস্তি সুবিধা নিন</li>
                <li>📊 আপনার লেনদেনের রিপোর্ট দেখুন</li>
            </ul>
            
            <div style="text-align: center;">
                <a href="https://your-domain.com/dashboard" class="button">ড্যাশবোর্ডে যান</a>
            </div>
        </div>
        
        <div class="footer">
            <p>© ২০২৬ বারাকাহ ফাইন্যান্স। সর্বস্বত্ব সংরক্ষিত।</p>
        </div>
    </div>
</body>
</html>
    `;

    try {
        const params = {
            from: SENDER_EMAIL,
            to: [recipientEmail],
            subject: subject,
            html: htmlContent
        };

        const email = await resend.emails.send(params);

        return {
            success: true,
            emailId: email.id,
            message: 'Welcome email sent successfully'
        };
    } catch (error) {
        console.error('Welcome email send error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    sendOTPEmail,
    sendWelcomeEmail
};
