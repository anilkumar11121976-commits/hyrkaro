import { env, isSmsConfigured } from './env.js';

export { isSmsConfigured };

/**
 * Send a transactional SMS. Mirrors the Razorpay pattern: with no provider keys
 * the app runs in DEMO mode instead of erroring — the OTP is logged (and, outside
 * production, returned by the API) so local testing works with no SMS account.
 *
 * @returns {Promise<{ok: boolean, mode: 'msg91'|'twilio'|'demo', id?: string, error?: string}>}
 */
export async function sendSms(phone, text) {
  const to = String(phone).replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(to)) return { ok: false, mode: 'demo', error: 'invalid_phone' };

  if (!isSmsConfigured()) {
    console.log(`[sms:demo] -> +91${to}: ${text}`);
    return { ok: true, mode: 'demo' };
  }

  try {
    if (env.sms.provider === 'msg91') return await sendViaMsg91(to, text);
    if (env.sms.provider === 'twilio') return await sendViaTwilio(to, text);
    return { ok: false, mode: 'demo', error: 'unknown_provider' };
  } catch (e) {
    console.error('[sms] send failed:', e.message);
    return { ok: false, mode: env.sms.provider, error: e.message };
  }
}

async function sendViaMsg91(to, text) {
  const res = await fetch('https://control.msg91.com/api/v5/flow/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', authkey: env.sms.msg91AuthKey },
    body: JSON.stringify({
      template_id: env.sms.msg91TemplateId,
      sender: env.sms.msg91SenderId,
      short_url: '0',
      recipients: [{ mobiles: `91${to}`, OTP: extractCode(text) || text }],
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.type === 'error') throw new Error(body?.message || `msg91 ${res.status}`);
  return { ok: true, mode: 'msg91', id: body?.request_id };
}

async function sendViaTwilio(to, text) {
  const auth = Buffer.from(`${env.sms.twilioSid}:${env.sms.twilioToken}`).toString('base64');
  const form = new URLSearchParams({ To: `+91${to}`, From: env.sms.twilioFrom, Body: text });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.sms.twilioSid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || `twilio ${res.status}`);
  return { ok: true, mode: 'twilio', id: body?.sid };
}

const extractCode = (text) => (String(text).match(/\b(\d{4,8})\b/) || [])[1];
