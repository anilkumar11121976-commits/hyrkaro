import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const num = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const bool = (v, d = false) => (v === undefined ? d : /^(1|true|yes|on)$/i.test(String(v)));

const isProd = process.env.NODE_ENV === 'production';

export const env = {
  isProd,
  nodeEnv: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 5000),
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hyrkro',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folder: process.env.CLOUDINARY_FOLDER || 'hyrkro',
  },
  razorpay: {
    keyId: (process.env.RAZORPAY_KEY_ID || '').trim(),
    keySecret: (process.env.RAZORPAY_KEY_SECRET || '').trim(),
    webhookSecret: (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim(),
  },
  // ---------- SMS / OTP (PDF §2) ----------
  // Kept for anyone who later wants SMS too, but requestOtp() below no longer
  // calls it by default — the OTP goes by email (see `email` below), which is
  // free to send and needs no paid gateway account.
  sms: {
    provider: (process.env.SMS_PROVIDER || '').trim().toLowerCase(), // 'msg91' | 'twilio' | '' (demo)
    msg91AuthKey: (process.env.MSG91_AUTH_KEY || '').trim(),
    msg91SenderId: (process.env.MSG91_SENDER_ID || 'HYRKRO').trim(),
    msg91TemplateId: (process.env.MSG91_TEMPLATE_ID || '').trim(),
    twilioSid: (process.env.TWILIO_ACCOUNT_SID || '').trim(),
    twilioToken: (process.env.TWILIO_AUTH_TOKEN || '').trim(),
    twilioFrom: (process.env.TWILIO_FROM || '').trim(),
  },
  // ---------- Email (OTP delivery) ----------
  // Free setup: a Gmail account + an "app password" (myaccount.google.com/apppasswords,
  // needs 2-step verification on) — set EMAIL_PROVIDER=gmail, EMAIL_USER=you@gmail.com,
  // EMAIL_PASS=<the 16-char app password>. No paid service required for low volume.
  // Any other SMTP inbox (Brevo, Mailtrap, your host's own SMTP, ...) works too: leave
  // EMAIL_PROVIDER blank and set EMAIL_HOST/EMAIL_PORT/EMAIL_USER/EMAIL_PASS instead.
  email: {
    provider: (process.env.EMAIL_PROVIDER || '').trim().toLowerCase(), // 'gmail' | '' (generic SMTP / demo)
    host: (process.env.EMAIL_HOST || '').trim(),
    port: num(process.env.EMAIL_PORT, 587),
    user: (process.env.EMAIL_USER || '').trim(),
    pass: (process.env.EMAIL_PASS || '').trim(),
    from: (process.env.EMAIL_FROM || '').trim(),
  },
  otp: {
    length: 6,
    ttlMinutes: num(process.env.OTP_TTL_MINUTES, 10),
    maxAttempts: num(process.env.OTP_MAX_ATTEMPTS, 5),
    resendWindowMinutes: num(process.env.OTP_RESEND_WINDOW_MINUTES, 60),
    maxPerWindow: num(process.env.OTP_MAX_PER_WINDOW, 5),
    // The code is returned in the API response whenever no real SMS provider is
    // wired up — a deploy can land with NODE_ENV=production but no SMS keys yet
    // (e.g. Render/Railway set NODE_ENV=production automatically), and tying this
    // to isProd alone would leave everyone locked out with the OTP visible nowhere.
    // The real gate against production users seeing a code is isSmsConfigured():
    // once SMS_PROVIDER is set with real keys, this stops being exposed regardless
    // of this flag.
    exposeInDemo: true,
  },
  // ---------- Business rules ----------
  commissionFree: num(process.env.COMMISSION_FREE_PERCENT, 10),
  commissionPro: num(process.env.COMMISSION_PRO_PERCENT, 5),
  proTrialDays: num(process.env.PRO_TRIAL_DAYS, 30),
  proPriceMonthly: num(process.env.PRO_PRICE_MONTHLY, 499),
  payoutDays: num(process.env.PAYOUT_DAYS, 3),
  requireKycForPayout: bool(process.env.REQUIRE_KYC_FOR_PAYOUT, true),
  // ---------- Ops ----------
  redisUrl: (process.env.REDIS_URL || '').trim(),
  runJobs: bool(process.env.RUN_BACKGROUND_JOBS, true),
};

export function assertEnv() {
  const problems = [];
  if (!env.jwtSecret || env.jwtSecret.length < 24 || env.jwtSecret.startsWith('change_this')) {
    if (env.isProd) problems.push('JWT_SECRET must be a long random string (24+ chars) in production');
    else console.warn('[env] JWT_SECRET is weak/default. Set a long random secret before going live.');
  }
  if (!env.mongoUri) problems.push('MONGO_URI is required');
  if (env.isProd && !isSmsConfigured() && !isEmailConfigured()) {
    console.warn(
      '[env] No SMS or email sender configured. OTP login will not reach anyone in production. ' +
        'Set EMAIL_PROVIDER=gmail + EMAIL_USER + EMAIL_PASS (free) or an SMS provider.',
    );
  }
  if (problems.length) {
    console.error('[env] Invalid configuration:\n - ' + problems.join('\n - '));
    process.exit(1);
  }
  if (!env.jwtSecret) env.jwtSecret = 'dev_only_insecure_secret_do_not_use_in_prod';
}

export function isSmsConfigured() {
  const s = env.sms;
  if (s.provider === 'msg91') return Boolean(s.msg91AuthKey);
  if (s.provider === 'twilio') return Boolean(s.twilioSid && s.twilioToken && s.twilioFrom);
  return false;
}

export function isEmailConfigured() {
  const e = env.email;
  if (!e.user || !e.pass) return false;
  if (e.provider === 'gmail') return true;
  return Boolean(e.host);
}