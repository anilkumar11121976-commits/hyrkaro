import { z } from 'zod';
import Waitlist from '../models/Waitlist.js';
import {
  CATEGORIES,
  CATEGORY_SLUGS,
  CITIES,
  CITY_SLUGS,
  INTEREST_DAILY_LIMIT,
  LANGS,
  MAX_UPLOAD_MB,
  BLOCKED_EXT,
  ACCOUNT_DELETE_DAYS,
  CHAT_FILE_TTL_DAYS,
} from '../config/constants.js';
import { env } from '../config/env.js';
import { isCloudinaryConfigured } from '../config/cloudinary.js';
import { isRazorpayConfigured } from '../config/razorpay.js';
import { isSmsConfigured } from '../config/sms.js';
import { getCommissionSettings } from '../services/settings.js';

export const waitlistSchema = z.object({
  name: z.string().trim().min(2, 'Naam likho').max(80),
  email: z.string().trim().toLowerCase().email('Sahi email likho'),
  phone: z
    .string()
    .trim()
    .regex(/^[6-9]\d{9}$/, 'Sahi 10 digit mobile number likho')
    .optional()
    .or(z.literal('')),
  type: z.enum(['freelancer', 'client']).default('freelancer'),
  city: z.enum([...CITY_SLUGS, '']).optional(),
  category: z.enum([...CATEGORY_SLUGS, '']).optional(),
  source: z.string().trim().max(60).optional(),
  acceptPolicy: z.literal(true, { errorMap: () => ({ message: 'Terms aur Privacy Policy accept karo' }) }),
});

export async function meta(_req, res) {
  const commission = await getCommissionSettings();
  res.json({
    success: true,
    categories: CATEGORIES,
    cities: CITIES,
    languages: LANGS,
    commission: { free: commission.free, pro: commission.pro, byCategory: commission.byCategory || {} },
    clientFee: 0,
    payoutDays: env.payoutDays,
    proTrialDays: env.proTrialDays,
    proPriceMonthly: env.proPriceMonthly,
    interestDailyLimit: INTEREST_DAILY_LIMIT,
    maxUploadMb: MAX_UPLOAD_MB,
    blockedExtensions: BLOCKED_EXT,
    accountDeleteDays: ACCOUNT_DELETE_DAYS,
    chatFileTtlDays: CHAT_FILE_TTL_DAYS,
    requireKycForPayout: env.requireKycForPayout,
    features: {
      uploads: isCloudinaryConfigured(),
      payments: isRazorpayConfigured() ? 'razorpay' : 'demo',
      otp: isSmsConfigured() ? 'sms' : 'demo',
    },
  });
}

export async function joinWaitlist(req, res) {
  const { acceptPolicy, ...data } = req.valid.body;
  // Keep the first signup date; only refresh the details.
  await Waitlist.updateOne(
    { email: data.email },
    { $set: data, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  );
  res.status(201).json({
    success: true,
    message: 'Aap waitlist mein jud gaye! Launch pe sabse pehle batayenge.',
  });
}
