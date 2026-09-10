const { Resend } = require('resend');
const nodemailer = require('nodemailer');

function resolveFromEmail(raw) {
  const fallback = 'TaskFlow Pro <onboarding@resend.dev>';
  if (!raw || typeof raw !== 'string') return fallback;
  let cleaned = raw.trim();
  if (cleaned.startsWith('FROM_EMAIL=')) cleaned = cleaned.replace(/^FROM_EMAIL=/, '').trim();
  cleaned = cleaned.replace(/^["'`]+|["'`]+$/g, '').trim();
  if (!cleaned) return fallback;
  const match = cleaned.match(/^([^<]*)<([^>]+)>$/);
  if (match) {
    const name = match[1].trim();
    const email = match[2].trim();
    if (email && email.includes('@')) return name ? `${name} <${email}>` : email;
  }
  if (cleaned.includes('@') && !cleaned.includes('<') && !cleaned.includes('>')) {
    return `TaskFlow Pro <${cleaned}>`;
  }
  return fallback;
}

class EmailService {
  constructor() {
    this.resendClient = null;
  }

  getResendClient() {
    const key = (process.env.RESEND_API_KEY || '').trim().replace(/^["'`]+|["'`]+$/g, '');
    if (key && !this.resendClient) {
      this.resendClient = new Resend(key);
    }
    return this.resendClient;
  }

  async sendPasswordResetEmail({ to, name, resetToken }) {
    const appUrl = (process.env.APP_URL || 'https://task-manager-website-psi.vercel.app').replace(/\/$/, '');
    const resetUrl = `${appUrl}/?resetToken=${encodeURIComponent(resetToken)}`;
    const from = resolveFromEmail(process.env.FROM_EMAIL);

    const subject = '🔐 Reset Your TaskFlow Pro Password';
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; background: #0b0f19; color: #f8fafc; border-radius: 12px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <div style="background: linear-gradient(135deg, #6366f1, #4f46e5); padding: 24px 30px;">
          <h1 style="margin: 0; font-size: 22px; color: #ffffff; font-weight: 700;">TaskFlow Pro Security</h1>
          <p style="margin: 6px 0 0 0; font-size: 13px; color: rgba(255,255,255,0.85);">Password Reset Request</p>
        </div>
        <div style="padding: 28px 30px;">
          <p style="font-size: 15px; color: #cbd5e1; margin-top: 0;">Hello ${name || 'there'},</p>
          <p style="font-size: 14px; color: #94a3b8; line-height: 1.6;">
            We received a request to reset your password for your TaskFlow Pro account. Click the secure button below to set a new password:
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #4f46e5); color: #ffffff; font-weight: 600; font-size: 14px; padding: 13px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
              Reset My Password
            </a>
          </div>
          <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-bottom: 8px;">
            ⚠️ This link will expire in <strong>15 minutes</strong> and can only be used once.
          </p>
          <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
            If you did not request this password reset, you can safely ignore this email — your account remains secure.
          </p>
          <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0 16px 0;" />
          <p style="font-size: 11px; color: #475569; word-break: break-all;">
            Or copy and paste this URL into your browser:<br />
            <a href="${resetUrl}" style="color: #818cf8;">${resetUrl}</a>
          </p>
        </div>
        <div style="background: #060911; padding: 14px 30px; font-size: 11px; color: #64748b; text-align: center;">
          TaskFlow Pro • Automated Security Service
        </div>
      </div>
    `;

    // 1. Try Resend HTTPS API
    const resend = this.getResendClient();
    if (resend) {
      try {
        const { data, error } = await resend.emails.send({
          from,
          to: [to],
          subject,
          html
        });
        if (!error) {
          console.log(`[EmailService] Password reset email sent to ${to} (ID: ${data?.id})`);
          return { success: true, messageId: data?.id };
        }
        console.warn('[EmailService] Resend returned error:', error.message);
      } catch (err) {
        console.warn('[EmailService] Resend exception:', err.message);
      }
    }

    // 2. Try SMTP if configured in .env
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '465', 10),
          secure: true,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
        const info = await transporter.sendMail({
          from: `"TaskFlow Pro" <${process.env.SMTP_USER}>`,
          to,
          subject,
          html
        });
        console.log(`[EmailService] Password reset sent via SMTP to ${to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
      } catch (smtpErr) {
        console.error('[EmailService] SMTP error:', smtpErr.message);
      }
    }

    console.log(`[EmailService] (Development Notice) Password reset link for ${to}:\n${resetUrl}`);
    return { success: true, previewUrl: resetUrl };
  }
}

module.exports = new EmailService();
