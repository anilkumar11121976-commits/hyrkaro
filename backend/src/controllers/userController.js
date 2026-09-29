import { z } from 'zod';
import User from '../models/User.js';
import FreelancerProfile from '../models/FreelancerProfile.js';
import Order from '../models/Order.js';
import Review from '../models/Review.js';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import Requirement from '../models/Requirement.js';
import Interest from '../models/Interest.js';
import Payment from '../models/Payment.js';
import Notification from '../models/Notification.js';
import { ACCOUNT_DELETE_DAYS, CITY_SLUGS, LANGS } from '../config/constants.js';
import { deleteAsset, isCloudinaryConfigured, uploadBuffer } from '../config/cloudinary.js';
import { notify } from '../services/notify.js';
import { addDays, paginate } from '../utils/helpers.js';
import { badRequest, AppError } from '../utils/AppError.js';

export const updateMeSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().toLowerCase().email('Sahi email likho').optional().or(z.literal('')),
  city: z.enum([...CITY_SLUGS, '']).optional(),
  companyName: z.string().trim().max(120).optional(),
  lang: z.enum(LANGS).optional(),
});

export const kycSchema = z.object({
  legalName: z.string().trim().min(2, 'PAN pe jo naam hai wo likho').max(120),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Sahi PAN number likho (जैसे ABCDE1234F)'),
  payoutMethod: z.enum(['upi', 'bank']),
  upiId: z.string().trim().max(80).optional(),
  accountNumber: z.string().trim().regex(/^\d{6,18}$/, 'Sahi account number likho').optional(),
  ifsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Sahi IFSC code likho')
    .optional(),
  bankName: z.string().trim().max(80).optional(),
}).refine(
  (d) => (d.payoutMethod === 'upi' ? Boolean(d.upiId) : Boolean(d.accountNumber && d.ifsc)),
  { message: 'Payout details poori bharo', path: ['payoutMethod'] },
);

export const deleteAccountSchema = z.object({
  confirm: z.literal('DELETE', { errorMap: () => ({ message: 'Confirm karne ke liye DELETE likho' }) }),
  reason: z.string().trim().max(500).optional().default(''),
});

export async function updateMe(req, res) {
  const patch = { ...req.valid.body };
  /**
   * Clearing the email has to remove the field, not store "". The unique index
   * is partial on `$type: 'string'`, so an empty string would still be indexed
   * and a second account clearing its email would collide.
   */
  const update = { $set: patch };
  if (patch.email === '') {
    delete patch.email;
    update.$unset = { email: 1 };
  }
  if (!Object.keys(patch).length) delete update.$set;

  const user = await User.findByIdAndUpdate(req.user._id, update, { new: true, runValidators: true });
  res.json({ success: true, user });
}

export async function uploadAvatar(req, res) {
  if (!req.file) throw badRequest('Photo select karo');
  if (!isCloudinaryConfigured()) throw new AppError('File upload abhi setup nahi hai (Cloudinary keys daalo)', 503);
  const result = await uploadBuffer(req.file.buffer, { folder: 'avatars', resourceType: 'image' });
  const user = await User.findById(req.user._id);
  const old = user.avatar?.publicId;
  user.avatar = { url: result.secure_url, publicId: result.public_id };
  await user.save({ validateBeforeSave: false });
  if (old) deleteAsset(old);
  res.json({ success: true, user });
}

/* ---------------- KYC (PDF §12) ---------------- */

export async function submitKyc(req, res) {
  const d = req.valid.body;
  const user = await User.findById(req.user._id);
  if (user.kyc?.status === 'verified') throw badRequest('KYC pehle se verified hai');

  user.kyc = {
    status: 'pending',
    legalName: d.legalName,
    panLast4: d.pan.slice(-4),
    payout: {
      method: d.payoutMethod,
      upiId: d.payoutMethod === 'upi' ? d.upiId : undefined,
      accountLast4: d.payoutMethod === 'bank' ? d.accountNumber.slice(-4) : undefined,
      ifsc: d.payoutMethod === 'bank' ? d.ifsc : undefined,
      bankName: d.payoutMethod === 'bank' ? d.bankName : undefined,
    },
    submittedAt: new Date(),
    note: undefined,
  };
  await user.save({ validateBeforeSave: false });
  res.json({ success: true, kyc: user.kyc, message: 'KYC review ke liye bhej diya. 24-48 ghante mein result milega.' });
}

export async function getKyc(req, res) {
  const user = await User.findById(req.user._id).select('kyc').lean();
  res.json({ success: true, kyc: user?.kyc || { status: 'none' } });
}

/* ---------------- notifications (PDF §15) ---------------- */

export async function listNotifications(req, res) {
  const { page, limit, skip } = paginate(req.query, { defLimit: 30, maxLimit: 100 });
  const [items, total, unread] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments({ user: req.user._id }),
    Notification.countDocuments({ user: req.user._id, readAt: null }),
  ]);
  res.json({ success: true, items, total, unread, page, pages: Math.ceil(total / limit) || 1 });
}

export async function markNotificationsRead(req, res) {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean) : null;
  const filter = { user: req.user._id, readAt: null };
  if (ids?.length) filter._id = { $in: ids };
  await Notification.updateMany(filter, { $set: { readAt: new Date() } });
  const unread = await Notification.countDocuments({ user: req.user._id, readAt: null });
  res.json({ success: true, unread });
}

/* ---------------- data export + account delete (PDF §17) ---------------- */

/** Everything this account holds, as one JSON download. */
export async function exportMyData(req, res) {
  const uid = req.user._id;
  const [user, profile, orders, reviews, requirements, interests, conversations, payments] = await Promise.all([
    User.findById(uid).lean(),
    FreelancerProfile.findOne({ user: uid }).lean(),
    Order.find({ $or: [{ client: uid }, { freelancer: uid }] }).lean(),
    Review.find({ $or: [{ client: uid }, { freelancer: uid }] }).lean(),
    Requirement.find({ client: uid }).lean(),
    Interest.find({ freelancer: uid }).lean(),
    Conversation.find({ $or: [{ client: uid }, { freelancer: uid }] }).lean(),
    Payment.find({ client: uid }).select('-razorpaySignature').lean(),
  ]);
  const messages = await Message.find({ conversation: { $in: conversations.map((c) => c._id) } })
    .sort({ createdAt: 1 })
    .lean();

  const payload = {
    exportedAt: new Date().toISOString(),
    note: 'HyrKro data export. Payment aur invoice records tax kaanoon ke liye rakhe jaate hain.',
    account: user,
    freelancerProfile: profile,
    orders,
    payments,
    reviews,
    requirements,
    interests,
    conversations,
    messages,
  };
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="hyrkro-data-${uid}.json"`);
  res.send(JSON.stringify(payload, null, 2));
}

/**
 * PDF §17: deletion is scheduled 30 days out, and blocked while money or work
 * is still in flight. Logging back in cancels it.
 */
export async function requestAccountDeletion(req, res) {
  const uid = req.user._id;
  const liveOrders = await Order.countDocuments({
    $or: [{ client: uid }, { freelancer: uid }],
    status: { $in: ['awaiting_acceptance', 'awaiting_payment', 'active', 'disputed'] },
  });
  if (liveOrders > 0) {
    throw badRequest(`Pehle ${liveOrders} chal rahe order poore ya cancel karo, phir account delete kar sakte ho.`);
  }
  const pendingPayout = await Order.countDocuments({
    freelancer: uid,
    'milestones.payout.status': { $in: ['due', 'on_hold'] },
  });
  if (pendingPayout > 0) throw badRequest('Aapka payout pending hai. Pehle wo settle hone do.');

  const user = await User.findById(uid);
  user.deletionRequestedAt = new Date();
  user.deletionScheduledFor = addDays(new Date(), ACCOUNT_DELETE_DAYS);
  await user.save({ validateBeforeSave: false });

  // A freelancer disappears from search straight away.
  await FreelancerProfile.updateOne({ user: uid }, { isVisible: false });
  await Requirement.updateMany({ client: uid, status: 'open' }, { $set: { status: 'closed', closedAt: new Date() } });

  await notify(uid, {
    type: 'admin_warning',
    title: 'Account delete request mil gayi',
    body: `${ACCOUNT_DELETE_DAYS} din mein data hat jayega. Wapas login karoge to request cancel ho jayegi.`,
    link: '/settings',
  });

  res.json({
    success: true,
    scheduledFor: user.deletionScheduledFor,
    message: `Account ${ACCOUNT_DELETE_DAYS} din mein delete ho jayega. Is beech login karoge to request apne aap cancel ho jayegi.`,
  });
}

export async function cancelAccountDeletion(req, res) {
  const user = await User.findById(req.user._id);
  if (!user.deletionRequestedAt) throw badRequest('Koi delete request pending nahi hai');
  user.deletionRequestedAt = undefined;
  user.deletionScheduledFor = undefined;
  await user.save({ validateBeforeSave: false });
  await FreelancerProfile.updateOne({ user: user._id }, { isVisible: true });
  res.json({ success: true, message: 'Delete request cancel ho gayi' });
}
