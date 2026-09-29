import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import User from '../models/User.js';
import Otp, { hashCode } from '../models/Otp.js';
import FreelancerProfile from '../models/FreelancerProfile.js';
import { env } from '../config/env.js';
import { CITY_SLUGS, LANGS } from '../config/constants.js';
import { sendOtpEmail, isEmailConfigured } from '../config/mailer.js';
import { addDays, signToken } from '../utils/helpers.js';
import { badRequest, forbidden, unauthorized, AppError } from '../utils/AppError.js';

/* ---------------- schemas ---------------- */

/**
 * Accept the ways people actually type an Indian mobile: bare 10 digits, a 91 or
 * +91 prefix, a leading 0, and spaces/dashes in between. Anything else longer is
 * REJECTED rather than truncated — silently trimming "98123456781" to a valid but
 * different number would send the OTP to a stranger.
 */
export function normalizePhone(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(3);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits; // wrong length: falls through to the refine below and is rejected
}

const phoneField = z
  .string()
  .trim()
  .transform(normalizePhone)
  .refine((s) => /^[6-9]\d{9}$/.test(s), 'Sahi 10 digit mobile number likho');

const emailField = z.string().trim().toLowerCase().email('Sahi email likho').max(120);

export const otpRequestSchema = z.object({
  phone: phoneField,
  // OTP now goes by email (free), not SMS — required on every request so a
  // resend can always be delivered somewhere.
  email: emailField,
  // Where the user was when they hit a login wall, so we can send them back (PDF §2).
  intent: z.string().trim().max(200).optional(),
});

export const otpVerifySchema = z.object({
  phone: phoneField,
  code: z.string().trim().regex(/^\d{4,8}$/, 'OTP sahi likho'),
  // Sent only when the account is new.
  name: z.string().trim().min(2, 'Naam likho').max(80).optional(),
  role: z.enum(['client', 'freelancer']).optional(),
  city: z.enum([...CITY_SLUGS, '']).optional(),
  companyName: z.string().trim().max(120).optional(),
  acceptPolicy: z.boolean().optional(),
  lang: z.enum(LANGS).optional(),
});

/**
 * The phone is NOT taken from the body here. `verifyOtp` hands back a short-lived
 * signed registration token that carries the verified number, so a half-finished
 * signup cannot be completed by someone who merely knows the phone number.
 */
export const completeProfileSchema = z.object({
  registrationToken: z.string().min(10, 'Dobara OTP se login karo'),
  name: z.string().trim().min(2, 'Naam likho').max(80),
  role: z.enum(['client', 'freelancer']),
  city: z.enum([...CITY_SLUGS, '']).optional().default(''),
  companyName: z.string().trim().max(120).optional(),
  acceptPolicy: z.literal(true, { errorMap: () => ({ message: 'Terms aur Privacy Policy accept karo' }) }),
  lang: z.enum(LANGS).optional(),
});

export const switchRoleSchema = z.object({ role: z.enum(['client', 'freelancer']) });
export const setLangSchema = z.object({ lang: z.enum(LANGS) });

// Admins still sign in with a password — the OTP flow is for clients/freelancers.
export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Sahi email likho'),
  password: z.string().min(1, 'Password likho'),
});
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z
    .string()
    .min(8, 'Password kam se kam 8 characters ka ho')
    .max(72)
    .regex(/[A-Za-z]/, 'Password mein kam se kam ek letter ho')
    .regex(/\d/, 'Password mein kam se kam ek number ho'),
});

/* ---------------- helpers ---------------- */

async function buildSession(user) {
  const token = signToken(user);
  let profile = null;
  if (user.role === 'freelancer') profile = await FreelancerProfile.findOne({ user: user._id });
  return { token, user, profile, roles: user.availableRoles() };
}

/** Freelancers get one free Pro month, granted exactly once (report H6). */
async function ensureFreelancerProfile(user) {
  let profile = await FreelancerProfile.findOne({ user: user._id });
  if (profile) {
    if (!profile.plan?.trialUsed && !profile.plan?.proUntil) {
      profile.plan = { type: 'pro', proUntil: addDays(new Date(), env.proTrialDays), trialUsed: true };
      await profile.save();
    }
    return profile;
  }
  profile = await FreelancerProfile.create({
    user: user._id,
    city: user.city || '',
    plan: { type: 'pro', proUntil: addDays(new Date(), env.proTrialDays), trialUsed: true },
    foundingFreelancer: true,
  });
  return profile;
}

const genCode = () => String(crypto.randomInt(0, 10 ** env.otp.length)).padStart(env.otp.length, '0');

/* ---------------- registration token ---------------- */

const REGISTRATION_TTL = '15m';

/** Proof that this phone number just passed an OTP check. Carries the email it
 *  was verified with too, so completeProfile() doesn't need it resent. */
const signRegistrationToken = (phone, email) =>
  jwt.sign({ purpose: 'register', phone, email }, env.jwtSecret, { expiresIn: REGISTRATION_TTL });

function readRegistrationToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw badRequest('Session purana ho gaya. Dobara OTP se login karo.');
  }
  if (payload?.purpose !== 'register' || !/^[6-9]\d{9}$/.test(String(payload.phone || ''))) {
    throw badRequest('Session purana ho gaya. Dobara OTP se login karo.');
  }
  return { phone: payload.phone, email: payload.email || '' };
}

/* ---------------- OTP login (PDF §2) ---------------- */

export async function requestOtp(req, res) {
  const { phone, email } = req.valid.body;
  const now = new Date();
  const windowMs = env.otp.resendWindowMinutes * 60_000;

  let row = await Otp.findOne({ phone });
  if (row) {
    const windowOpen = now - new Date(row.windowStartedAt) < windowMs;
    if (windowOpen && row.sentCount >= env.otp.maxPerWindow) {
      const mins = Math.ceil((windowMs - (now - new Date(row.windowStartedAt))) / 60_000);
      throw new AppError(`Bahut zyada OTP maange. ${mins} minute baad try karo.`, 429);
    }
    // One email per 30 seconds per number.
    if (now - new Date(row.lastSentAt) < 30_000) {
      throw new AppError('Thodi der ruko, OTP abhi bheja hai.', 429);
    }
    if (!windowOpen) {
      row.windowStartedAt = now;
      row.sentCount = 0;
    }
  }

  const code = genCode();
  const update = {
    email,
    codeHash: hashCode(phone, code),
    expiresAt: new Date(now.getTime() + env.otp.ttlMinutes * 60_000),
    attempts: 0,
    lastSentAt: now,
    consumedAt: null,
    $inc: { sentCount: 1 },
  };
  const { $inc, ...set } = update;
  await Otp.updateOne(
    { phone },
    { $set: { ...set, windowStartedAt: row?.windowStartedAt || now }, $inc },
    { upsert: true },
  );

  const mail = await sendOtpEmail(email, code, env.otp.ttlMinutes);
  if (!mail.ok && mail.mode !== 'demo') {
    throw new AppError('OTP nahi bhej paye. Thodi der baad try karo.', 502);
  }

  const exists = await User.exists({ phone, deletedAt: null });
  res.json({
    success: true,
    sent: true,
    isNewUser: !exists,
    expiresInSec: env.otp.ttlMinutes * 60,
    mode: isEmailConfigured() ? 'email' : 'demo',
    // Demo mode only, and never once a real EMAIL_* / SMS key is set: lets you
    // test with no email account configured.
    ...(env.otp.exposeInDemo && !isEmailConfigured() ? { demoCode: code } : {}),
    message: isEmailConfigured() ? `OTP bhej diya ${email} pe` : 'Demo mode: Email keys nahi hain, OTP screen pe dikh raha hai',
  });
}

export async function verifyOtp(req, res) {
  const { phone, code, name, role, city, companyName, acceptPolicy, lang } = req.valid.body;
  const row = await Otp.findOne({ phone });
  if (!row || row.consumedAt) throw badRequest('Pehle OTP mangao');
  if (row.expiresAt < new Date()) throw badRequest('OTP expire ho gaya, naya mangao');
  if (row.attempts >= env.otp.maxAttempts) throw new AppError('Bahut galat koshishein. Naya OTP mangao.', 429);

  if (!row.matches(code)) {
    await Otp.updateOne({ _id: row._id }, { $inc: { attempts: 1 } });
    const left = env.otp.maxAttempts - row.attempts - 1;
    throw badRequest(left > 0 ? `OTP galat hai. ${left} koshish bachi hai.` : 'OTP galat hai. Naya OTP mangao.');
  }

  let user = await User.findOne({ phone });

  if (user?.deletedAt) throw forbidden('Ye account delete ho chuka hai. Support se baat karein.');
  if (user?.isBlocked) throw forbidden(user.blockReason || 'Aapka account block hai. Support se baat karein.');

  // New account: name + role must come with the verification (PDF §2).
  if (!user) {
    if (!name || !role) {
      /**
       * The code is correct but we still need a name and a role. Burn the OTP so
       * it cannot be replayed, and hand back a short-lived token that proves this
       * number was verified — `completeProfile` reads the phone from that token.
       */
      await Otp.updateOne({ _id: row._id }, { $set: { consumedAt: new Date(), attempts: 0 } });
      return res.json({
        success: true,
        verified: true,
        needsProfile: true,
        phone,
        registrationToken: signRegistrationToken(phone, row.email),
        expiresInSec: 15 * 60,
      });
    }
    if (acceptPolicy !== true) throw badRequest('Terms aur Privacy Policy accept karo');
    user = await User.create({
      name,
      phone,
      email: row.email || undefined,
      role,
      roles: [role],
      city: city || '',
      companyName: role === 'client' ? companyName : undefined,
      lang: lang || 'hinglish',
      phoneVerifiedAt: new Date(),
      acceptedPolicyAt: new Date(),
    });
    if (role === 'freelancer') await ensureFreelancerProfile(user);
  } else {
    user.phoneVerifiedAt = new Date();
    user.lastSeenAt = new Date();
    if (lang) user.lang = lang;
    // Fill in the email the first time we see one — never overwrite one already saved.
    if (!user.email && row.email) user.email = row.email;
    // A returning user who asked to delete their account is un-deleting it by logging in.
    if (user.deletionRequestedAt) {
      user.deletionRequestedAt = undefined;
      user.deletionScheduledFor = undefined;
    }
    await user.save({ validateBeforeSave: false });
  }

  await Otp.updateOne({ _id: row._id }, { $set: { consumedAt: new Date(), attempts: 0 } });
  res.json({ success: true, verified: true, isNew: !user.updatedAt || user.createdAt === user.updatedAt, ...(await buildSession(user)) });
}

/** Second step when verifyOtp returned needsProfile. */
export async function completeProfile(req, res) {
  const { registrationToken, name, role, city, companyName, acceptPolicy, lang } = req.valid.body;
  // The verified number (and the email the OTP was sent to) come from the
  // signed token, never from the request body.
  const { phone, email } = readRegistrationToken(registrationToken);

  if (acceptPolicy !== true) throw badRequest('Terms aur Privacy Policy accept karo');
  if (await User.exists({ phone })) throw badRequest('Account pehle se hai, login karo');

  const user = await User.create({
    name,
    phone,
    email: email || undefined,
    role,
    roles: [role],
    city: city || '',
    companyName: role === 'client' ? companyName : undefined,
    lang: lang || 'hinglish',
    phoneVerifiedAt: new Date(),
    acceptedPolicyAt: new Date(),
  });
  if (role === 'freelancer') await ensureFreelancerProfile(user);
  res.status(201).json({ success: true, ...(await buildSession(user)) });
}

/** PDF §2: "Client aur freelancer ek hi account mein role switch kar sakte hain." */
export async function switchRole(req, res) {
  const { role } = req.valid.body;
  const user = req.user;
  if (user.role === 'admin') throw forbidden('Admin account ka role switch nahi hota');
  if (user.role === role) return res.json({ success: true, ...(await buildSession(user)) });

  user.role = role;
  user.roles = [...new Set([...(user.roles || []), role])];
  await user.save({ validateBeforeSave: false });
  if (role === 'freelancer') await ensureFreelancerProfile(user);

  // The JWT carries the role, so switching issues a fresh token.
  res.json({ success: true, switched: true, ...(await buildSession(user)) });
}

export async function setLang(req, res) {
  req.user.lang = req.valid.body.lang;
  await req.user.save({ validateBeforeSave: false });
  res.json({ success: true, lang: req.user.lang });
}

/* ---------------- admin password login ---------------- */

export async function adminLogin(req, res) {
  const { email, password } = req.valid.body;
  const user = await User.findOne({ email, role: 'admin' }).select('+password');
  if (!user || !(await user.comparePassword(password))) throw unauthorized('Email ya password galat hai');
  if (user.isBlocked) throw forbidden('Ye account block hai');
  user.lastSeenAt = new Date();
  await user.save({ validateBeforeSave: false });
  user.password = undefined;
  res.json({ success: true, ...(await buildSession(user)) });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.valid.body;
  const user = await User.findById(req.user._id).select('+password');
  if (!user.password) throw badRequest('Is account mein password nahi hai, OTP se login karo');
  if (!(await user.comparePassword(currentPassword))) throw badRequest('Purana password galat hai');
  user.password = newPassword;
  await user.save();
  res.json({ success: true, message: 'Password badal gaya', token: signToken(user) });
}

export async function me(req, res) {
  let profile = null;
  if (req.user.role === 'freelancer') profile = await FreelancerProfile.findOne({ user: req.user._id });
  res.json({ success: true, user: req.user, profile, roles: req.user.availableRoles() });
}

export { ensureFreelancerProfile };