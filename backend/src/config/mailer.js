import nodemailer from 'nodemailer';
import { env, isEmailConfigured } from './env.js';

export { isEmailConfigured };

let transporter;

// nodemailer's own defaults are meant for a long-lived server (connection
// timeout 2 min, socket timeout 10 min) — fine on a machine you own, but on a
// host like Render a blocked or throttled outbound SMTP port turns that into
// a request that never comes back, instead of a quick, visible error.
const TIMEOUTS = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000 };

/** Built once and reused — creating a new SMTP connection per email is slow. */
function getTransporter() {
  if (transporter) return transporter;
  transporter =
    env.email.provider === 'gmail'
      ? nodemailer.createTransport({
          service: 'gmail',
          auth: { user: env.email.user, pass: env.email.pass },
          ...TIMEOUTS,
        })
      : nodemailer.createTransport({
          host: env.email.host,
          port: env.email.port,
          secure: env.email.port === 465,
          auth: env.email.user ? { user: env.email.user, pass: env.email.pass } : undefined,
          ...TIMEOUTS,
        });
  return transporter;
}

const subjectFor = (code) => `${code} aapka HyrKro OTP hai`;
const textFor = (code, ttlMinutes) =>
  `${code} aapka HyrKro OTP hai. ${ttlMinutes} minute mein expire ho jayega. Kisi se share mat karo.`;
const htmlFor = (code, ttlMinutes) => `
  <div style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px;">
    <p style="font-size:15px;color:#111;">Aapka HyrKro OTP:</p>
    <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#111;margin:8px 0 16px;">${code}</p>
    <p style="font-size:13px;color:#666;">${ttlMinutes} minute mein expire ho jayega. Kisi se share mat karo.</p>
  </div>
`;

/**
 * Brevo's transactional email API — plain HTTPS (port 443), so it goes
 * through on hosts (Render included) that block outbound SMTP. A manual
 * AbortController timeout stands in for fetch's lack of a built-in one.
 */
async function sendViaBrevo(to, code, ttlMinutes) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': env.email.apiKey, 'Content-Type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: env.email.from, name: 'HyrKro' },
        to: [{ email: to }],
        subject: subjectFor(code),
        textContent: textFor(code, ttlMinutes),
        htmlContent: htmlFor(code, ttlMinutes),
      }),
      signal: controller.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body?.message || `brevo ${res.status}`);
    return { ok: true, mode: 'brevo' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sends the OTP by email. Mirrors sendSms(): with no EMAIL_* keys set the app
 * runs in DEMO mode instead of erroring — the code is logged (and, per
 * env.otp.exposeInDemo, returned by the API) so local testing needs no inbox.
 *
 * @returns {Promise<{ok: boolean, mode: 'brevo'|'gmail'|'smtp'|'demo', error?: string}>}
 */
export async function sendOtpEmail(to, code, ttlMinutes) {
  if (!isEmailConfigured()) {
    console.log(`[email:demo] -> ${to}: OTP ${code}`);
    return { ok: true, mode: 'demo' };
  }

  if (env.email.provider === 'brevo') {
    try {
      return await sendViaBrevo(to, code, ttlMinutes);
    } catch (e) {
      console.error('[email] send failed:', e.message);
      return { ok: false, mode: 'brevo', error: e.message };
    }
  }

  const mode = env.email.provider === 'gmail' ? 'gmail' : 'smtp';
  // Belt and braces on top of the transporter's own timeouts above — a stuck
  // DNS lookup, for instance, isn't always covered by connectionTimeout, and
  // this guarantees the request in front of this never waits more than ~18s.
  const hardCap = new Promise((_, reject) => setTimeout(() => reject(new Error('email_send_timeout')), 18_000));

  try {
    await Promise.race([
      getTransporter().sendMail({
        from: env.email.from || env.email.user,
        to,
        subject: subjectFor(code),
        text: textFor(code, ttlMinutes),
        html: htmlFor(code, ttlMinutes),
      }),
      hardCap,
    ]);
    return { ok: true, mode };
  } catch (e) {
    console.error('[email] send failed:', e.message);
    return { ok: false, mode, error: e.message };
  }
}