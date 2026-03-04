const nodemailer = require('nodemailer');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const FROM_NAME = 'Task Tracker';

// Lazily created transporter — skips gracefully if Gmail creds aren't set (local dev)
let _transporter = null;
const getTransporter = () => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD, // Gmail App Password — NOT your real password
      },
    });
  }
  return _transporter;
};

/**
 * Send email verification link after registration
 */
const sendVerificationEmail = async (name, email, token) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[emailService] Gmail credentials not set — skipping verification email for', email);
    return;
  }

  const verifyUrl = `${FRONTEND_URL}/verify-email/${token}`;

  await transporter.sendMail({
    from: `"${FROM_NAME}" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Verify your Task Tracker account',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#1e293b;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
                <tr>
                  <td style="background:linear-gradient(135deg,#F59E0B,#FBBF24);padding:32px;text-align:center;">
                    <h1 style="margin:0;color:#1a1a2e;font-size:28px;font-weight:800;letter-spacing:-0.5px;">✓ Task Tracker</h1>
                    <p style="margin:6px 0 0;color:#92400e;font-size:14px;font-weight:500;">Your productivity companion</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:36px 32px;">
                    <h2 style="margin:0 0 12px;color:#f1f5f9;font-size:22px;font-weight:700;">Welcome, ${name}! 👋</h2>
                    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">
                      Thanks for signing up. Please verify your email address to activate your account and start tracking your tasks.
                    </p>
                    <a href="${verifyUrl}"
                       style="display:block;background:linear-gradient(135deg,#F59E0B,#FBBF24);color:#1a1a2e;text-decoration:none;font-weight:700;font-size:16px;padding:14px 32px;border-radius:10px;text-align:center;margin:0 0 24px;">
                      Verify Email Address
                    </a>
                    <p style="margin:0 0 8px;color:#64748b;font-size:13px;">Or copy this link into your browser:</p>
                    <p style="margin:0 0 24px;word-break:break-all;color:#FBBF24;font-size:12px;">${verifyUrl}</p>
                    <hr style="border:none;border-top:1px solid #334155;margin:0 0 20px;">
                    <p style="margin:0;color:#64748b;font-size:12px;">This link expires in <strong style="color:#94a3b8;">24 hours</strong>. If you didn't create an account, you can safely ignore this email.</p>
                  </td>
                </tr>
                <tr>
                  <td style="background:#0f172a;padding:20px 32px;text-align:center;">
                    <p style="margin:0;color:#475569;font-size:12px;">© ${new Date().getFullYear()} Task Tracker Pro. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });
};

/**
 * Send a welcome email after successful verification
 */
const sendWelcomeEmail = async (name, email) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('[emailService] Gmail credentials not set — skipping welcome email for', email);
    return;
  }

  await transporter.sendMail({
    from: `"${FROM_NAME}" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: 'Welcome to Task Tracker Pro! 🎉',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#1e293b;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="background:linear-gradient(135deg,#F59E0B,#FBBF24);padding:32px;text-align:center;">
                    <h1 style="margin:0;color:#1a1a2e;font-size:28px;font-weight:800;">✓ Task Tracker</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:36px 32px;">
                    <h2 style="margin:0 0 12px;color:#f1f5f9;font-size:22px;font-weight:700;">You're all set, ${name}! 🎉</h2>
                    <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">
                      Your email has been verified. Start organizing your tasks, setting deadlines, and boosting your productivity.
                    </p>
                    <a href="${FRONTEND_URL}/login"
                       style="display:block;background:linear-gradient(135deg,#F59E0B,#FBBF24);color:#1a1a2e;text-decoration:none;font-weight:700;font-size:16px;padding:14px 32px;border-radius:10px;text-align:center;">
                      Go to Dashboard
                    </a>
                  </td>
                </tr>
                <tr>
                  <td style="background:#0f172a;padding:20px 32px;text-align:center;">
                    <p style="margin:0;color:#475569;font-size:12px;">© ${new Date().getFullYear()} Task Tracker Pro. All rights reserved.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  }).catch(err => console.error('Welcome email error (non-critical):', err));
};

module.exports = { sendVerificationEmail, sendWelcomeEmail };
