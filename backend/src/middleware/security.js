import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { deepSanitize } from '../utils/helpers.js';
import { env } from '../config/env.js';

/** Report M1: query is sanitized too, not just body and params. */
export const sanitizeRequest = (req, _res, next) => {
  if (req.body) deepSanitize(req.body);
  if (req.params) deepSanitize(req.params);
  if (req.query) {
    try {
      deepSanitize(req.query);
    } catch {
      /* express 5 exposes query through a getter on some setups; ignore */
    }
  }
  next();
};

const msg = (message) => ({ success: false, message });

/**
 * Report M9: shared store when REDIS_URL is set, so limits survive deploys and
 * work across instances. Without it the in-memory store is used, as before.
 */
let sharedStore;
if (env.redisUrl) {
  try {
    const { default: RedisStore } = await import('rate-limit-redis');
    const { createClient } = await import('redis');
    const client = createClient({ url: env.redisUrl });
    await client.connect();
    sharedStore = new RedisStore({ sendCommand: (...args) => client.sendCommand(args) });
    console.log('[rate-limit] Redis store attached');
  } catch (e) {
    console.warn('[rate-limit] Redis store not attached, using memory:', e.message);
  }
}

const base = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  ...(sharedStore ? { store: sharedStore } : {}),
};

export const apiLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 600,
  message: msg('Bahut zyada requests. Thodi der baad try karo.'),
});

/**
 * Report M9: keying auth attempts on IP alone locks out offices and CGNAT
 * mobile ranges. Key on the phone number when one is present, IP otherwise.
 */
export const authLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 30,
  // ipKeyGenerator normalises IPv6 so a /64 cannot walk around the limit.
  keyGenerator: (req, res) => {
    const phone = String(req.body?.phone || '').replace(/\D/g, '').slice(-10);
    return phone ? `phone:${phone}` : `ip:${ipKeyGenerator(req, res)}`;
  },
  message: msg('Bahut zyada koshishein. 15 minute baad try karo.'),
});

/** OTP requests get their own, tighter budget on top of the per-number rules. */
export const otpLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 20,
  keyGenerator: (req, res) => {
    const phone = String(req.body?.phone || '').replace(/\D/g, '').slice(-10);
    return phone ? `otp:${phone}` : `otp-ip:${ipKeyGenerator(req, res)}`;
  },
  message: msg('Bahut zyada OTP maange. Thodi der baad try karo.'),
});

export const uploadLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 100,
  message: msg('Upload limit poori ho gayi. Thodi der baad try karo.'),
});

export const writeLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 120,
  message: msg('Bahut zyada requests. Thodi der baad try karo.'),
});
