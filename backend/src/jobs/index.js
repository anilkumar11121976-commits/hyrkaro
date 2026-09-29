import User from '../models/User.js';
import Order from '../models/Order.js';
import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import FreelancerProfile from '../models/FreelancerProfile.js';
import Requirement from '../models/Requirement.js';
import Review from '../models/Review.js';
import Interest from '../models/Interest.js';
import Notification from '../models/Notification.js';
import { deleteAsset } from '../config/cloudinary.js';
import { notify } from '../services/notify.js';
import { env } from '../config/env.js';

const HOUR = 3600_000;
const timers = [];

/**
 * Small in-process scheduler. Everything here is idempotent and safe to run on
 * several instances, but if you scale out, run it on one instance only by
 * setting RUN_BACKGROUND_JOBS=false on the rest.
 */
export function startJobs() {
  if (!env.runJobs) {
    console.log('[jobs] disabled (RUN_BACKGROUND_JOBS=false)');
    return;
  }
  const every = (ms, fn, name) => {
    const run = async () => {
      try {
        const n = await fn();
        if (n) console.log(`[jobs] ${name}: ${n}`);
      } catch (e) {
        console.error(`[jobs] ${name} failed:`, e.message);
      }
    };
    // Stagger the first run so a restart does not fire everything at once.
    timers.push(setTimeout(run, 30_000 + Math.random() * 30_000));
    timers.push(setInterval(run, ms));
  };

  every(6 * HOUR, purgeOldChatFiles, 'purge chat files');
  every(12 * HOUR, expireProPlans, 'expire pro plans');
  every(12 * HOUR, warnExpiringPlans, 'warn expiring plans');
  every(12 * HOUR, expireRequirements, 'expire requirements');
  every(12 * HOUR, runScheduledDeletions, 'account deletions');
  console.log('[jobs] background jobs started');
}

export function stopJobs() {
  timers.forEach((t) => {
    clearTimeout(t);
    clearInterval(t);
  });
  timers.length = 0;
}

/** PDF §5/§9: chat + delivery files go 6 months after the order completes. */
export async function purgeOldChatFiles() {
  const now = new Date();
  const due = await Message.find({ 'file.purgeAt': { $lte: now }, 'file.purgedAt': null })
    .select('file conversation')
    .limit(200);
  let n = 0;
  for (const msg of due) {
    if (msg.file?.publicId) await deleteAsset(msg.file.publicId, msg.file.resourceType || 'raw');
    await Message.updateOne(
      { _id: msg._id },
      { $set: { 'file.purgedAt': now, 'file.url': '', 'file.publicId': '' } },
    );
    n += 1;
  }

  // Delivery files on the order itself.
  const orders = await Order.find({ filesPurgeAt: { $lte: now }, status: 'completed' }).limit(50);
  for (const order of orders) {
    for (const ms of order.milestones) {
      for (const f of ms.submission?.files || []) {
        if (f.publicId) await deleteAsset(f.publicId, f.resourceType || 'raw');
      }
      if (ms.submission) {
        ms.submission.files = [];
        ms.submission.preview = [];
      }
    }
    order.filesPurgeAt = undefined;
    await order.save();
    n += 1;
  }
  return n;
}

/** PDF §13: "Subscription na bharne pe plan Free ho jata hai, profile live rehti hai." */
export async function expireProPlans() {
  const now = new Date();
  const expired = await FreelancerProfile.find({
    'plan.type': 'pro',
    'plan.proUntil': { $lt: now },
  }).select('user plan').limit(500);

  let n = 0;
  for (const p of expired) {
    await FreelancerProfile.updateOne(
      { _id: p._id },
      { $set: { 'plan.type': 'free', 'plan.downgradedAt': now } },
    );
    await notify(p.user, {
      type: 'plan_expired',
      title: 'Pro khatam ho gaya',
      body: `Ab commission ${env.commissionFree}% lagega. Profile live hai — Pro dobara lene ke liye dashboard dekho.`,
      link: '/dashboard',
    });
    n += 1;
  }
  return n;
}

/** Nudge three days before Pro lapses. */
export async function warnExpiringPlans() {
  const now = new Date();
  const in3 = new Date(now.getTime() + 3 * 24 * HOUR);
  const soon = await FreelancerProfile.find({
    'plan.type': 'pro',
    'plan.proUntil': { $gt: now, $lte: in3 },
  }).select('user plan').limit(500);

  let n = 0;
  for (const p of soon) {
    const already = await Notification.findOne({
      user: p.user,
      type: 'plan_expiring',
      createdAt: { $gte: new Date(now.getTime() - 4 * 24 * HOUR) },
    }).select('_id').lean();
    if (already) continue;
    await notify(p.user, {
      type: 'plan_expiring',
      title: 'Pro 3 din mein khatam',
      body: `Renew nahi kiya to commission ${env.commissionPro}% se ${env.commissionFree}% ho jayega.`,
      link: '/dashboard',
    });
    n += 1;
  }
  return n;
}

export async function expireRequirements() {
  const r = await Requirement.updateMany(
    { status: 'open', expiresAt: { $lte: new Date() } },
    { $set: { status: 'expired', closedAt: new Date() } },
  );
  return r.modifiedCount || 0;
}

/**
 * PDF §17: 30 days after the request the personal data goes. Payment and
 * invoice rows stay for tax law, with the account anonymised instead of dropped.
 */
export async function runScheduledDeletions() {
  const now = new Date();
  const users = await User.find({ deletionScheduledFor: { $lte: now }, deletedAt: null }).limit(50);
  let n = 0;

  for (const user of users) {
    const uid = user._id;
    const convs = await Conversation.find({ $or: [{ client: uid }, { freelancer: uid }] }).select('_id').lean();
    const convIds = convs.map((c) => c._id);

    // Drop their media.
    const profile = await FreelancerProfile.findOne({ user: uid }).select('portfolio').lean();
    for (const item of profile?.portfolio || []) {
      if (item.publicId) await deleteAsset(item.publicId, item.resourceType || 'image');
    }
    if (user.avatar?.publicId) await deleteAsset(user.avatar.publicId);

    const fileMsgs = await Message.find({ conversation: { $in: convIds }, sender: uid, type: 'file' })
      .select('file')
      .lean();
    for (const m of fileMsgs) {
      if (m.file?.publicId) await deleteAsset(m.file.publicId, m.file.resourceType || 'raw');
    }

    await Promise.all([
      FreelancerProfile.deleteOne({ user: uid }),
      Requirement.deleteMany({ client: uid }),
      Interest.deleteMany({ freelancer: uid }),
      Notification.deleteMany({ user: uid }),
      Message.updateMany(
        { conversation: { $in: convIds }, sender: uid },
        { $set: { text: '[deleted account]', 'file.url': '', 'file.publicId': '', 'file.purgedAt': now } },
      ),
      Review.updateMany({ client: uid }, { $set: { comment: '[deleted account]' } }),
    ]);

    // Anonymise rather than delete: orders and payments are tax records.
    const stamp = String(uid).slice(-6);
    user.set({
      name: 'Deleted user',
      phone: `000000${stamp}`.slice(-10),
      email: undefined,
      avatar: undefined,
      companyName: undefined,
      city: '',
      password: undefined,
      kyc: { status: 'none' },
      isBlocked: true,
      blockReason: 'account deleted',
      deletedAt: now,
      deletionScheduledFor: undefined,
    });
    await user.save({ validateBeforeSave: false });
    n += 1;
  }
  return n;
}
