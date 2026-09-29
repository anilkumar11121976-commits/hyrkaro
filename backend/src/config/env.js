import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const num = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const bool = (v, d = false) =>
  v === undefined ? d : /^(1|true|yes|on)$/i.test(String(v));

const isProd = process.env.NODE_ENV === 'production';

export const env = {
  isProd,

  nodeEnv: process.env.NODE_ENV || 'development',

  port: num(process.env.PORT, 5000),

  clientUrls: (process.env.CLIENT_URL || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),

  // ---------- MongoDB ----------
  // MONGODB_URI is the preferred variable.
  // MONGO_URI is kept as a backward-compatible fallback.
  mongoUri:
    process.env.MONGODB_URI ||
    process.env.MONGO_URI ||
    'mongodb://127.0.0.1:27017/hyrkro',

  // ---------- JWT ----------
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  // ---------- Cloudinary ----------
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folder: process.env.CLOUDINARY_FOLDER || 'hyrkro',
  },

  // ---------- Razorpay ----------
  razorpay: {
    keyId: (process.env.RAZORPAY_KEY_ID || '').trim(),
    keySecret: (process.env.RAZORPAY_KEY_SECRET || '').trim(),
    webhookSecret: (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim(),
  },

  // ---------- SMS / OTP ----------
  sms: {
    provider: (process.env.SMS_PROVIDER || '').trim().toLowerCase(),
    // 'msg91' | 'twilio' | '' (demo)

    msg91AuthKey: (process.env.MSG91_AUTH_KEY || '').trim(),
    msg91SenderId: (process.env.MSG91_SENDER_ID || 'HYRKRO').trim(),
    msg91TemplateId: (process.env.MSG91_TEMPLATE_ID || '').trim(),

    twilioSid: (process.env.TWILIO_ACCOUNT_SID || '').trim(),
    twilioToken: (process.env.TWILIO_AUTH_TOKEN || '').trim(),
    twilioFrom: (process.env.TWILIO_FROM || '').trim(),
  },

  // ---------- OTP ----------
  otp: {
    length: 6,

    ttlMinutes: num(process.env.OTP_TTL_MINUTES, 10),

    maxAttempts: num(process.env.OTP_MAX_ATTEMPTS, 5),

    resendWindowMinutes: num(
      process.env.OTP_RESEND_WINDOW_MINUTES,
      60
    ),

    maxPerWindow: num(
      process.env.OTP_MAX_PER_WINDOW,
      5
    ),

    // Demo mode only.
    // OTP is never exposed in production.
    exposeInDemo: !isProd,
  },

  // ---------- Business rules ----------
  commissionFree: num(
    process.env.COMMISSION_FREE_PERCENT,
    10
  ),

  commissionPro: num(
    process.env.COMMISSION_PRO_PERCENT,
    5
  ),

  proTrialDays: num(
    process.env.PRO_TRIAL_DAYS,
    30
  ),

  proPriceMonthly: num(
    process.env.PRO_PRICE_MONTHLY,
    499
  ),

  payoutDays: num(
    process.env.PAYOUT_DAYS,
    3
  ),

  requireKycForPayout: bool(
    process.env.REQUIRE_KYC_FOR_PAYOUT,
    true
  ),

  // ---------- Ops ----------
  redisUrl: (process.env.REDIS_URL || '').trim(),

  runJobs: bool(
    process.env.RUN_BACKGROUND_JOBS,
    true
  ),
};

export function assertEnv() {
  const problems = [];

  if (
    !env.jwtSecret ||
    env.jwtSecret.length < 24 ||
    env.jwtSecret.startsWith('change_this')
  ) {
    if (env.isProd) {
      problems.push(
        'JWT_SECRET must be a long random string (24+ chars) in production'
      );
    } else {
      console.warn(
        '[env] JWT_SECRET is weak/default. Set a long random secret before going live.'
      );
    }
  }

  if (!env.mongoUri) {
    problems.push('MONGODB_URI is required');
  }

  if (env.isProd && !isSmsConfigured()) {
    console.warn(
      '[env] No SMS provider configured. OTP login will fail in production. Set SMS_PROVIDER + keys.'
    );
  }

  if (problems.length) {
    console.error(
      '[env] Invalid configuration:\n - ' +
        problems.join('\n - ')
    );

    process.exit(1);
  }

  if (!env.jwtSecret) {
    env.jwtSecret = 'dev_only_insecure_secret_do_not_use_in_prod';
  }
}

export function isSmsConfigured() {
  const s = env.sms;

  if (s.provider === 'msg91') {
    return Boolean(s.msg91AuthKey);
  }

  if (s.provider === 'twilio') {
    return Boolean(
      s.twilioSid &&
        s.twilioToken &&
        s.twilioFrom
    );
  }

  return false;
}