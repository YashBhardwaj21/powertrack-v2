import nodemailer from 'nodemailer';
import { config } from '../config/index.js';
import { logger } from './logger.js';

// ---------------------------------------------------------------------------
// Build a transporter from env vars.
// Supports any SMTP provider: Gmail, SendGrid, Outlook, Brevo, Mailtrap, etc.
// ---------------------------------------------------------------------------
const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465, // true for port 465, false for 587/25
    auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
    },
});

/**
 * Send a password-reset email.
 * @param to       Recipient email address
 * @param resetLink Full URL to the reset-password page (includes token)
 */
export const sendPasswordResetEmail = async (to: string, resetLink: string): Promise<void> => {
    if (!config.smtpHost || !config.smtpUser || !config.smtpPass) {
        // No SMTP configured — fall back to logging the link (dev mode behaviour)
        logger.warn({ to, resetLink }, '📧 SMTP not configured. Reset link logged here (dev only).');
        return;
    }

    const fromName = config.emailFromName || 'PowerTrack';
    const fromAddress = config.emailFromAddress || config.smtpUser;

    await transporter.sendMail({
        from: `"${fromName}" <${fromAddress}>`,
        to,
        subject: 'Reset your PowerTrack password',
        html: `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Inter,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#1e293b;border-radius:16px;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1d4ed8,#2563eb);padding:32px 24px;text-align:center;">
            <div style="font-size:28px;margin-bottom:8px;">⚡</div>
            <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">PowerTrack</h1>
            <p style="margin:4px 0 0;color:#bfdbfe;font-size:13px;">Solar Monitoring Platform</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px 24px;">
            <h2 style="margin:0 0 8px;color:#f1f5f9;font-size:18px;">Reset your password</h2>
            <p style="margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.6;">
              We received a request to reset the password for your account.
              Click the button below to choose a new password. This link expires in <strong style="color:#e2e8f0;">1 hour</strong>.
            </p>
            <a href="${resetLink}"
               style="display:block;background:#2563eb;color:#fff;text-align:center;padding:14px 24px;
                      border-radius:10px;font-size:15px;font-weight:600;text-decoration:none;margin-bottom:24px;">
              Reset Password
            </a>
            <p style="margin:0 0 8px;color:#64748b;font-size:12px;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="margin:0;word-break:break-all;color:#3b82f6;font-size:12px;">${resetLink}</p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 24px;border-top:1px solid #334155;text-align:center;">
            <p style="margin:0;color:#475569;font-size:11px;">
              If you didn't request a password reset, you can safely ignore this email.<br>
              Your password will remain unchanged.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        text: `Reset your PowerTrack password\n\nClick the link below (expires in 1 hour):\n${resetLink}\n\nIf you didn't request this, ignore this email.`,
    });

    logger.info({ to }, '📧 Password reset email sent');
};
