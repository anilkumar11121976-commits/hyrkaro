import nodemailer from 'nodemailer';
import { env, isEmailConfigured } from './env.js';

export { isEmailConfigured };

let transporter;

/** Built once and reused — creating a new SMTP connection per email is slow. */
function getTransporter() {
  if (transporter) return transporter;
  transporter =
    env.email.provider === 'gmail'
      ? nodemailer.createTransport({ service: 'gmail', auth: { user: env.email.user, pass: env.email.pass } })
      : nodemailer.createTransport({
          host: env.email.host,
          port: env.email.port,
          secure: env.email.port === 465,
          auth: env.email.user ? { user: env.email.user, pass: env.email.pass } : undefined,
        });
  return transporter;
}

/**
 * Sends the OTP by email. Mirrors sendSms(): with no EMAIL_* keys set the app
 * runs in DEMO mode instead of erroring — the code is logged (and, per
 * env.otp.exposeInDemo, returned by the API) so local testing needs no inbox.
 *
 * @returns {Promise<{ok: boolean, mode: 'gmail'|'smtp'|'demo', error?: string}>}
 */
export async function sendOtpEmail(to, code, ttlMinutes) {
  if (!isEmailConfigured()) {
    console.log(`[email:demo] -> ${to}: OTP ${code}`);
    return { ok: true, mode: 'demo' };
  }

  try {
    await getTransporter().sendMail({
      from: env.email.from || env.email.user,
      to,
      subject: `${code} aapka HyrKro OTP hai`,
      text: `${code} aapka HyrKro OTP hai. ${ttlMinutes} minute mein expire ho jayega. Kisi se share mat karo.`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px;">
          <p style="font-size:15px;color:#111;">Aapka HyrKro OTP:</p>
          <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#111;margin:8px 0 16px;">${code}</p>
          <p style="font-size:13px;color:#666;">${ttlMinutes} minute mein expire ho jayega. Kisi se share mat karo.</p>
        </div>
      `,
    });
    return { ok: true, mode: env.email.provider === 'gmail' ? 'gmail' : 'smtp' };
  } catch (e) {
    console.error('[email] send failed:', e.message);
    return { ok: false, mode: env.email.provider === 'gmail' ? 'gmail' : 'smtp', error: e.message };
  }
}