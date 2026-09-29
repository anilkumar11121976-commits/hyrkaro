import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { badRequest } from './AppError.js';

export const signToken = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

export const verifyToken = (token) => jwt.verify(token, env.jwtSecret);

export const isId = (v) => mongoose.Types.ObjectId.isValid(v) && String(new mongoose.Types.ObjectId(v)) === String(v);

export const assertId = (v, label = 'id') => {
  if (!isId(v)) throw badRequest(`Galat ${label}`);
  return v;
};

export const paginate = (query, { defLimit = 12, maxLimit = 50 } = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defLimit));
  return { page, limit, skip: (page - 1) * limit };
};

export const escapeRegex = (s = '') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export const addDays = (d, days) => new Date(new Date(d).getTime() + days * 86400000);

export const dayKey = (d = new Date()) => new Date(d).toISOString().slice(0, 10);

/* ------------------------------------------------------------------ *
 * Contact masking (PDF §5, report H3)
 *
 * The old version missed UPI handles, most social links, and numbers written
 * with dots or underscores, while masking any 10-digit number including
 * budgets and invoice numbers. This version is separator-tolerant, knows about
 * UPI, and skips numbers that a nearby currency word marks as money.
 * ------------------------------------------------------------------ */

// 10 digits starting 6-9, allowing space, dot, dash, underscore or slash between them.
const SEP = '[\\s._\\-/]{0,2}';
const PHONE_RE = new RegExp(`(?:\\+?91${SEP})?[6-9](?:${SEP}\\d){9}`, 'g');
// Digits spelled out in Hindi/English, e.g. "nau aath saat chhe ...".
const WORD_DIGITS =
  '(?:zero|one|two|three|four|five|six|seven|eight|nine|shoonya|sunya|ek|do|teen|tin|char|chaar|paanch|panch|chhe|che|chah|saat|sat|aath|ath|nau|no)';
const WORD_PHONE_RE = new RegExp(`(?:${WORD_DIGITS}[\\s,.-]+){9,}${WORD_DIGITS}`, 'gi');

const EMAIL_RE = /[A-Z0-9._%+-]+\s*(?:@|\[at\]|\(at\)|\s+at\s+)\s*[A-Z0-9.-]+\s*(?:\.|\[dot\]|\(dot\)|\s+dot\s+)\s*[A-Z]{2,}/gi;

// UPI VPA: handle@bank where the suffix has no dot — the exact case the old regex missed.
const UPI_HANDLES =
  '(?:upi|ybl|okhdfcbank|okicici|okaxis|oksbi|paytm|ptyes|ptaxis|ptsbi|apl|ibl|axl|airtel|freecharge|jio|fbl|idfcbank|kotak|yesbank|indus|barodampay|sbi|hdfcbank|icici|axisbank|pockets|dbs|federal|cnrb|uboi|unionbank|rbl|timecosmos|waaxis|wahdfcbank|waicici|wasbi)';
const UPI_RE = new RegExp(`\\b[\\w.\\-]{2,}@${UPI_HANDLES}\\b`, 'gi');
const UPI_HINT_RE = /\b(?:upi\s*id|upi|gpay|g\s*pay|google\s*pay|phone\s*pe|phonepe|paytm|bhim|qr\s*code|scan\s*karo|bank\s*(?:account|acc|a\/c)|ifsc|account\s*number)\b/gi;

// Any external contact/booking/payment surface.
const LINK_RE = new RegExp(
  '\\b(?:(?:https?://)?(?:www\\.)?)?' +
    '(?:wa\\.me|whatsapp\\.com|chat\\.whatsapp\\.com|t\\.me|telegram\\.me|telegram\\.org|signal\\.me|' +
    'instagram\\.com|instagr\\.am|facebook\\.com|fb\\.me|m\\.me|messenger\\.com|linkedin\\.com|lnkd\\.in|' +
    'twitter\\.com|x\\.com|snapchat\\.com|discord\\.gg|discord\\.com|skype\\.com|join\\.skype\\.com|' +
    'calendly\\.com|cal\\.com|zoom\\.us|meet\\.google\\.com|teams\\.microsoft\\.com|' +
    'upwork\\.com|fiverr\\.com|freelancer\\.com|truelancer\\.com|' +
    'paypal\\.me|razorpay\\.me|rzp\\.io|buymeacoffee\\.com|gum\\.co)' +
    '(?:/\\S*)?',
  'gi',
);
const HANDLE_RE = /(?:^|\s)@[a-z0-9._]{3,30}\b/gi;

// A number right next to a money word is an amount, not a phone number.
const MONEY_NEAR =
  /(?:₹|rs\.?|inr|rupa?ye?|rupees?|budget|amount|price|rate|invoice|gst|bill|total|per\s+\w+)/i;

const MASKS = {
  phone: '[number hidden]',
  email: '[email hidden]',
  upi: '[payment id hidden]',
  link: '[link hidden]',
  handle: ' [handle hidden]',
};

/**
 * Hide phone numbers, emails, UPI handles and external chat/payment links.
 * @returns {{text: string, flagged: boolean, kinds: string[]}}
 */
export function maskContactInfo(text = '') {
  const kinds = new Set();
  let out = String(text);

  const apply = (re, kind, guard) => {
    out = out.replace(re, (match, ...rest) => {
      const offset = rest[rest.length - 2];
      if (guard && !guard(match, out, offset)) return match;
      kinds.add(kind);
      return MASKS[kind];
    });
  };

  // Order matters: email and UPI before the bare-phone pass.
  apply(EMAIL_RE, 'email');
  apply(UPI_RE, 'upi');
  apply(LINK_RE, 'link');
  apply(WORD_PHONE_RE, 'phone');
  apply(PHONE_RE, 'phone', (match, full, offset) => {
    const digits = match.replace(/\D/g, '');
    // 12 digits with the 91 prefix is still a phone; anything longer is not.
    if (digits.length > 12) return false;
    const around = full.slice(Math.max(0, offset - 24), offset + match.length + 12);
    // Keep amounts readable: "Budget 7000000000 rupaye" stays as written.
    if (MONEY_NEAR.test(around)) return false;
    return true;
  });
  apply(HANDLE_RE, 'handle');

  // A payment-method word with no handle attached is still a nudge off-platform.
  if (UPI_HINT_RE.test(out)) kinds.add('payment_hint');

  return { text: out, flagged: kinds.size > 0, kinds: [...kinds] };
}

/** Remove keys starting with "$" or containing "." (NoSQL injection guard). */
export function deepSanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    // Report M2: mutate in place so the caller's reference stays sanitized.
    obj.forEach((v, i) => {
      obj[i] = deepSanitize(v);
    });
    return obj;
  }
  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) delete obj[key];
    else obj[key] = deepSanitize(obj[key]);
  }
  return obj;
}

export const pick = (obj, keys) =>
  keys.reduce((acc, k) => {
    if (obj[k] !== undefined) acc[k] = obj[k];
    return acc;
  }, {});

/** Strip payout/commission detail before an order goes to the client (report M6). */
export const stripPayout = (order) => {
  if (!order?.milestones) return order;
  order.milestones = order.milestones.map((m) => {
    const { payout, ...rest } = m;
    return rest;
  });
  return order;
};

/**
 * PDF §9: until a milestone is released the client only sees the watermarked
 * preview — never the real deliverable URLs.
 */
export const stripUnreleasedFiles = (order) => {
  if (!order?.milestones) return order;
  order.milestones = order.milestones.map((m) => {
    if (m.status === 'released' || !m.submission) return m;
    return { ...m, submission: { ...m.submission, files: [], fileCount: m.submission.files?.length || 0 } };
  });
  return order;
};
