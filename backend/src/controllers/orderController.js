import { z } from 'zod';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Message from '../models/Message.js';
import Review from '../models/Review.js';
import Payment from '../models/Payment.js';
import Requirement from '../models/Requirement.js';
import FreelancerProfile from '../models/FreelancerProfile.js';
import User from '../models/User.js';
import { CHAT_FILE_TTL_DAYS, MS_NAMES, MS_SPLIT } from '../config/constants.js';
import { env } from '../config/env.js';
import { isCloudinaryConfigured } from '../config/cloudinary.js';
import { emitToUsers } from '../sockets/index.js';
import { commissionFor } from '../services/settings.js';
import { notify } from '../services/notify.js';
import { uploadDelivery, canPreview } from '../services/watermark.js';
import { addDays, isId, paginate, round2, stripPayout, stripUnreleasedFiles } from '../utils/helpers.js';
import { AppError, badRequest, forbidden, notFound } from '../utils/AppError.js';
import { createMessage, loadConversation } from './chatController.js';

const USER_PUBLIC = 'name avatar role city companyName';

export const createOrderSchema = z.object({
  conversationId: z.string().min(1),
  // Report C4: an order must come from an offer the freelancer accepted.
  offerMessageId: z.string().min(1, 'Pehle offer accept karwao'),
  title: z.string().trim().min(3, 'Kaam ka title likho').max(140),
  description: z.string().trim().max(3000).optional().default(''),
  plan: z.coerce.number().int().min(1).max(3).default(1),
  requirementId: z.string().optional(),
});

export const listOrdersSchema = z.object({
  status: z
    .enum(['awaiting_acceptance', 'awaiting_payment', 'active', 'completed', 'cancelled', 'disputed', 'refunded'])
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const changesSchema = z.object({ note: z.string().trim().min(3, 'Kya badlav chahiye, likho').max(1000) });
export const cancelSchema = z.object({ reason: z.string().trim().max(500).optional().default('') });
export const declineSchema = z.object({ reason: z.string().trim().max(500).optional().default('') });
export const disputeSchema = z.object({
  milestoneId: z.string().optional(),
  reason: z.string().trim().min(10, 'Dispute ki wajah thodi detail mein likho').max(2000),
});
export const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional().default(''),
});

/* ---------------- helpers ---------------- */

export function splitMilestones(amount, plan) {
  const split = MS_SPLIT[plan] || MS_SPLIT[1];
  const names = MS_NAMES[plan] || MS_NAMES[1];
  let used = 0;
  return split.map((pct, i) => {
    const raw = i === split.length - 1 ? amount - used : Math.floor((amount * pct) / 100);
    // Report (low): never emit a zero-rupee milestone, which the schema rejects.
    const a = Math.max(1, raw);
    used += a;
    return { title: names[i], amount: a, status: 'pending' };
  });
}

export async function loadOrder(id, user) {
  if (!isId(id)) throw notFound('Order nahi mila');
  const order = await Order.findById(id);
  if (!order) throw notFound('Order nahi mila');
  if (user.role !== 'admin' && !order.isMember(user._id)) throw forbidden('Ye order aapka nahi hai');
  return order;
}

export function emitOrder(order) {
  emitToUsers([order.client, order.freelancer], 'order:update', {
    orderId: String(order._id),
    status: order.status,
  });
}

function findMilestone(order, msId) {
  const ms = order.milestones.id(msId);
  if (!ms) throw notFound('Milestone nahi mila');
  return ms;
}

/** Try to post a system line into the order's chat; never fail the action for it. */
async function systemLine(order, actorId, text) {
  try {
    const conv = await loadConversation(order.conversation, actorId);
    await createMessage(conv, actorId, { type: 'system', text });
  } catch (e) {
    console.warn('[order] system message failed:', e.message);
  }
}

/* ---------------- create / accept ---------------- */

export async function createOrder(req, res) {
  if (req.user.role !== 'client') throw forbidden('Sirf client hire kar sakta hai');
  const data = req.valid.body;
  const conv = await loadConversation(data.conversationId, req.user._id);
  if (String(conv.client) !== String(req.user._id)) throw forbidden('Ye chat aapki nahi hai');

  const profile = await FreelancerProfile.findOne({ user: conv.freelancer });
  if (!profile || profile.verification.status !== 'verified') {
    throw badRequest('Ye freelancer abhi hire ke liye available nahi hai');
  }

  if (!isId(data.offerMessageId)) throw badRequest('Galat offer');

  /**
   * Report M4: claim the offer atomically. Two concurrent hires can no longer
   * both read "accepted" and both create an order.
   */
  const offerMsg = await Message.findOneAndUpdate(
    {
      _id: data.offerMessageId,
      conversation: conv._id,
      type: 'offer',
      'offer.status': 'accepted',
    },
    { $set: { 'offer.status': 'used' } },
    { new: true },
  );
  if (!offerMsg) throw badRequest('Sirf accepted offer se hire kar sakte ho. Pehle offer bhej ke accept karwao.');

  const amount = offerMsg.offer.amount;
  const deliveryDays = offerMsg.offer.deliveryDays;
  const commissionPercent = await commissionFor({ category: profile.category, isPro: profile.isPro });

  let order;
  try {
    order = await Order.create({
      client: conv.client,
      freelancer: conv.freelancer,
      conversation: conv._id,
      offerMessage: offerMsg._id,
      requirement: isId(data.requirementId) ? data.requirementId : undefined,
      title: data.title,
      description: data.description,
      amount,
      deliveryDays,
      commissionPercent,
      clientFee: 0,
      milestones: splitMilestones(amount, data.plan),
      status: 'awaiting_acceptance',
    });
  } catch (e) {
    // Give the offer back if the order could not be created.
    await Message.updateOne({ _id: offerMsg._id }, { $set: { 'offer.status': 'accepted' } });
    throw e;
  }

  offerMsg.offer.order = order._id;
  await offerMsg.save();
  emitToUsers([conv.client, conv.freelancer], 'message:update', {
    conversationId: String(conv._id),
    message: offerMsg.toJSON(),
  });

  await systemLine(
    order,
    req.user._id,
    `Order ${order.orderNo} bana: "${order.title}" – ₹${amount.toLocaleString('en-IN')} (${order.milestones.length} milestone). Freelancer ke accept karne ke baad payment hoga.`,
  );
  await notify(order.freelancer, {
    type: 'order_created',
    title: 'Naya order aaya',
    body: `${order.title} – ₹${amount.toLocaleString('en-IN')}. Accept ya decline karo.`,
    link: `/orders/${order._id}`,
  });
  emitOrder(order);
  res.status(201).json({ success: true, order });
}

/** Report C4: the freelancer accepts before any money moves. */
export async function acceptOrder(req, res) {
  const order = await loadOrder(req.params.id, req.user);
  if (String(order.freelancer) !== String(req.user._id)) throw forbidden('Sirf freelancer accept kar sakta hai');
  if (order.status !== 'awaiting_acceptance') throw badRequest('Is order pe pehle hi faisla ho chuka hai');

  order.status = 'awaiting_payment';
  order.acceptedAt = new Date();
  await order.save();

  await systemLine(order, req.user._id, `Freelancer ne order ${order.orderNo} accept kiya. Ab pehla milestone fund karo.`);
  await notify(order.client, {
    type: 'order_accepted',
    title: 'Order accept ho gaya',
    body: `${order.title} – ab pehla milestone pay karo.`,
    link: `/orders/${order._id}`,
  });
  emitOrder(order);
  res.json({ success: true, order });
}

export async function declineOrder(req, res) {
  const order = await loadOrder(req.params.id, req.user);
  if (String(order.freelancer) !== String(req.user._id)) throw forbidden('Sirf freelancer decline kar sakta hai');
  if (order.status !== 'awaiting_acceptance') throw badRequest('Is order pe pehle hi faisla ho chuka hai');

  order.status = 'cancelled';
  order.declinedAt = new Date();
  order.declineReason = req.valid.body.reason;
  order.cancelledAt = new Date();
  order.cancelledBy = req.user._id;
  await order.save();

  // Put the offer back so the two sides can renegotiate.
  if (order.offerMessage) {
    await Message.updateOne({ _id: order.offerMessage }, { $set: { 'offer.status': 'declined' } });
  }
  await systemLine(
    order,
    req.user._id,
    `Freelancer ne order ${order.orderNo} decline kiya${order.declineReason ? `: ${order.declineReason}` : ''}. Naya offer bhej sakte ho.`,
  );
  await notify(order.client, {
    type: 'order_declined',
    title: 'Order decline hua',
    body: order.declineReason || order.title,
    link: `/orders/${order._id}`,
  });
  emitOrder(order);
  res.json({ success: true, order });
}

/* ---------------- read ---------------- */

export async function listOrders(req, res) {
  const q = req.valid.query;
  const { page, limit, skip } = paginate(q, { defLimit: 20 });
  const uid = req.user._id;
  const filter = req.user.role === 'freelancer' ? { freelancer: uid } : { client: uid };
  if (q.status) filter.status = q.status;
  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('client', USER_PUBLIC)
      .populate('freelancer', USER_PUBLIC)
      .lean(),
    Order.countDocuments(filter),
  ]);
  // Report M6: the client never sees commission/payout figures, here either.
  const shaped = req.user.role === 'client' ? items.map((o) => stripUnreleasedFiles(stripPayout(o))) : items;
  res.json({ success: true, items: shaped, total, page, pages: Math.ceil(total / limit) || 1 });
}

export async function getOrder(req, res) {
  const order = await loadOrder(req.params.id, req.user);
  await order.populate([
    { path: 'client', select: USER_PUBLIC },
    { path: 'freelancer', select: USER_PUBLIC },
  ]);
  const review = order.reviewed ? await Review.findOne({ order: order._id, hidden: false }).lean() : null;
  let out = order.toJSON();
  if (req.user.role === 'client') {
    // PDF §9 + report M6: no payout figures, and no real delivery files before release.
    out = stripUnreleasedFiles(stripPayout(out));
  }
  res.json({ success: true, order: out, review });
}

/* ---------------- delivery (PDF §9) ---------------- */

export async function submitMilestone(req, res) {
  const order = await loadOrder(req.params.id, req.user);
  if (String(order.freelancer) !== String(req.user._id)) throw forbidden('Sirf freelancer kaam submit kar sakta hai');
  if (order.status === 'disputed') throw badRequest('Dispute chal raha hai, pehle wo resolve ho');
  const ms = findMilestone(order, req.params.msId);
  if (!['funded', 'changes_requested'].includes(ms.status)) throw badRequest('Pehle client is milestone ka payment kare');

  const note = String(req.body?.note || '').trim().slice(0, 2000);
  const files = req.files || [];
  if (!note && !files.length) throw badRequest('Note likho ya file lagao');
  if (files.length && !isCloudinaryConfigured()) {
    throw new AppError('File upload abhi setup nahi hai (Cloudinary keys daalo)', 503);
  }

  const uploaded = await Promise.all(files.map((f) => uploadDelivery(f, order._id)));
  ms.status = 'submitted';
  ms.submittedAt = new Date();
  ms.submission = {
    note,
    files: uploaded.map((u) => u.original),
    preview: uploaded.map((u) => u.preview),
    revision: (ms.submission?.revision || 0) + 1,
  };
  await order.save();

  const previewable = uploaded.filter((u) => canPreview(u.original.mime)).length;
  await systemLine(
    order,
    req.user._id,
    `"${ms.title}" submit hua (Order ${order.orderNo}). Client ko ${previewable ? 'watermark preview' : 'file list'} dikh rahi hai; approve karte hi original files khul jayengi.`,
  );
  await notify(order.client, {
    type: 'milestone_submitted',
    title: 'Kaam submit hua',
    body: `${ms.title} – preview dekh ke approve karo.`,
    link: `/orders/${order._id}`,
  });
  emitOrder(order);
  const out = stripPayout(stripUnreleasedFiles(order.toJSON()));
  res.json({ success: true, order: req.user.role === 'client' ? out : order });
}

export async function approveMilestone(req, res) {
  const order = await loadOrder(req.params.id, req.user);
  if (String(order.client) !== String(req.user._id)) throw forbidden('Sirf client approve kar sakta hai');
  if (order.status === 'disputed') throw badRequest('Dispute chal raha hai, pehle wo resolve ho');
  const ms = findMilestone(order, req.params.msId);
  if (ms.status !== 'submitted') throw badRequest('Ye milestone abhi submit nahi hua');

  const commission = round2((ms.amount * order.commissionPercent) / 100);

  // PDF §12: no payout without KYC. The money is still released from escrow,
  // it just sits on hold until the freelancer finishes verification.
  const freelancer = await User.findById(order.freelancer).select('kyc name');
  const kycOk = !env.requireKycForPayout || freelancer?.kyc?.status === 'verified';

  ms.status = 'released';
  ms.releasedAt = new Date();
  ms.payout = {
    amount: round2(ms.amount - commission),
    commission,
    commissionPercent: order.commissionPercent,
    dueAt: addDays(new Date(), env.payoutDays),
    status: kycOk ? 'due' : 'on_hold',
    holdReason: kycOk ? undefined : 'KYC pending',
  };

  const allDone = order.milestones.every((m) => ['released', 'refunded'].includes(m.status));
  if (allDone) {
    order.status = 'completed';
    order.completedAt = new Date();
    // PDF §5/§9: files are purged 6 months after completion.
    order.filesPurgeAt = addDays(new Date(), CHAT_FILE_TTL_DAYS);
    await FreelancerProfile.updateOne({ user: order.freelancer }, { $inc: { completedOrders: 1 } });
    await Message.updateMany(
      { conversation: order.conversation, type: 'file' },
      { $set: { 'file.purgeAt': order.filesPurgeAt } },
    );
  }
  await order.save();

  await systemLine(
    order,
    req.user._id,
    allDone
      ? `Order ${order.orderNo} poora hua. Original files khul gayi hain. Payment ${env.payoutDays} din mein freelancer ko milega. Review dena mat bhoolna!`
      : `"${ms.title}" approve hua, original files khul gayi hain. Payment ${env.payoutDays} din mein. Agla milestone fund karo.`,
  );
  await notify(order.freelancer, {
    type: kycOk ? 'milestone_approved' : 'payout_due',
    title: kycOk ? 'Milestone approve hua' : 'Approve hua – KYC pending',
    body: kycOk
      ? `${ms.title} – ₹${ms.payout.amount.toLocaleString('en-IN')} ${env.payoutDays} din mein aayega.`
      : `${ms.title} ka paisa ready hai, par payout ke liye KYC poori karo.`,
    link: `/orders/${order._id}`,
  });
  emitOrder(order);
  res.json({ success: true, order });
}

export async function requestChanges(req, res) {
  const order = await loadOrder(req.params.id, req.user);
  if (String(order.client) !== String(req.user._id)) throw forbidden('Sirf client badlav maang sakta hai');
  const ms = findMilestone(order, req.params.msId);
  if (ms.status !== 'submitted') throw badRequest('Ye milestone abhi submit nahi hua');
  ms.status = 'changes_requested';
  ms.changesNote = req.valid.body.note;
  ms.changeRequests = (ms.changeRequests || 0) + 1;
  await order.save();

  await systemLine(order, req.user._id, `"${ms.title}" mein badlav chahiye: ${req.valid.body.note}`);
  await notify(order.freelancer, {
    type: 'milestone_changes',
    title: 'Badlav chahiye',
    body: `${ms.title}: ${req.valid.body.note.slice(0, 120)}`,
    link: `/orders/${order._id}`,
  });
  emitOrder(order);
  res.json({ success: true, order });
}

/* ---------------- cancel + refund (report C1, PDF §10) ---------------- */

/**
 * Refund every milestone that is still holding money, then close the order.
 * Razorpay refunds are issued when keys are configured; in demo mode the rows
 * are marked refunded so the flow is identical end to end.
 */
export async function refundOrderEscrow(order, { reason, by, onlyMilestoneId = null } = {}) {
  const { getRazorpay, isRazorpayConfigured } = await import('../config/razorpay.js');
  const rzp = isRazorpayConfigured() ? getRazorpay() : null;
  const refunded = [];

  for (const ms of order.milestones) {
    if (onlyMilestoneId && String(ms._id) !== String(onlyMilestoneId)) continue;
    if (!['funded', 'submitted', 'changes_requested'].includes(ms.status)) continue;

    const payment = await Payment.findOne({ order: order._id, milestoneId: ms._id, status: 'paid' });
    if (payment) {
      payment.status = 'refund_pending';
      payment.refund = { amount: ms.amount, reason, requestedAt: new Date(), by };
      await payment.save();
      if (rzp && payment.razorpayPaymentId) {
        try {
          const r = await rzp.payments.refund(payment.razorpayPaymentId, {
            amount: Math.round(ms.amount * 100),
            speed: 'normal',
            notes: { orderId: String(order._id), milestoneId: String(ms._id), reason: String(reason).slice(0, 200) },
          });
          payment.refund.razorpayRefundId = r.id;
          payment.status = 'refunded';
          payment.refund.completedAt = new Date();
        } catch (e) {
          console.error('[refund] razorpay refund failed:', e.message);
          payment.refund.note = e.message;
          // Stays refund_pending for an admin to retry.
        }
      } else {
        payment.status = 'refunded';
        payment.refund.completedAt = new Date();
      }
      await payment.save();
    }

    ms.status = 'refunded';
    ms.refund = { amount: ms.amount, status: 'done', at: new Date(), reason };
    ms.payout = { ...(ms.payout?.toObject?.() || ms.payout || {}), status: 'none' };
    refunded.push({ milestoneId: String(ms._id), amount: ms.amount });
  }
  return refunded;
}

export async function cancelOrder(req, res) {
  const order = await loadOrder(req.params.id, req.user);
  const isClient = String(order.client) === String(req.user._id);
  const isFreelancer = String(order.freelancer) === String(req.user._id);
  const isAdmin = req.user.role === 'admin';
  if (!isClient && !isFreelancer && !isAdmin) throw forbidden();
  if (['completed', 'cancelled', 'refunded'].includes(order.status)) throw badRequest('Ye order pehle hi band hai');

  const held = order.escrowHeld();
  // Before any money moves either side may cancel freely. After that, only a
  // mutual-ish path: the freelancer may cancel and refund, the client must use
  // the dispute flow so someone reviews it.
  if (held > 0 && isClient && !isAdmin) {
    throw badRequest('Paisa escrow mein hai. Cancel ke liye "Dispute kholo" use karo — HyrKro review karke refund karega.');
  }

  const reason = req.valid.body.reason || (isAdmin ? 'Admin ne cancel kiya' : 'Cancel kiya gaya');
  const refunded = held > 0 ? await refundOrderEscrow(order, { reason, by: req.user._id }) : [];

  order.status = refunded.length ? 'refunded' : 'cancelled';
  order.cancelledAt = new Date();
  order.cancelledBy = req.user._id;
  order.cancelReason = reason;
  await order.save();

  const total = refunded.reduce((s, r) => s + r.amount, 0);
  await systemLine(
    order,
    req.user._id,
    total
      ? `Order ${order.orderNo} cancel hua. ₹${total.toLocaleString('en-IN')} client ko refund kar diya (5-7 din mein bank mein).`
      : `Order ${order.orderNo} cancel hua${reason ? `: ${reason}` : ''}.`,
  );
  await notify(isClient ? order.freelancer : order.client, {
    type: 'order_cancelled',
    title: 'Order cancel hua',
    body: total ? `₹${total.toLocaleString('en-IN')} refund ho gaya.` : reason,
    link: `/orders/${order._id}`,
  });
  if (total) {
    await notify(order.client, {
      type: 'refund_issued',
      title: 'Refund issue ho gaya',
      body: `₹${total.toLocaleString('en-IN')} – 5-7 din mein aapke account mein.`,
      link: `/orders/${order._id}`,
    });
  }
  emitOrder(order);
  res.json({ success: true, order, refunded });
}

/* ---------------- dispute (PDF §10) ---------------- */

export async function openDispute(req, res) {
  const order = await loadOrder(req.params.id, req.user);
  if (!order.isMember(req.user._id)) throw forbidden();
  if (order.status === 'disputed') throw badRequest('Dispute pehle se khula hai');
  if (['cancelled', 'refunded'].includes(order.status)) throw badRequest('Ye order band ho chuka hai');
  if (order.escrowHeld() === 0 && order.status !== 'completed') {
    throw badRequest('Dispute tabhi khulta hai jab paisa escrow mein ho');
  }

  const { milestoneId, reason } = req.valid.body;
  if (milestoneId && !order.milestones.id(milestoneId)) throw notFound('Milestone nahi mila');

  order.dispute = {
    status: 'open',
    raisedBy: req.user._id,
    milestoneId: milestoneId || undefined,
    reason,
    openedAt: new Date(),
  };
  order.status = 'disputed';
  // Payouts freeze while a dispute is open.
  order.milestones.forEach((m) => {
    if (m.payout?.status === 'due') {
      m.payout.status = 'on_hold';
      m.payout.holdReason = 'Dispute open';
    }
  });
  await order.save();

  const other = String(order.client) === String(req.user._id) ? order.freelancer : order.client;
  await systemLine(
    order,
    req.user._id,
    `Dispute khula (Order ${order.orderNo}): ${reason.slice(0, 200)}. HyrKro team chat, offer aur delivered files dekh ke faisla karegi.`,
  );
  await notify(other, {
    type: 'dispute_opened',
    title: 'Dispute khula hai',
    body: reason.slice(0, 140),
    link: `/orders/${order._id}`,
  });
  emitOrder(order);
  res.json({ success: true, order });
}

export async function withdrawDispute(req, res) {
  const order = await loadOrder(req.params.id, req.user);
  if (order.status !== 'disputed') throw badRequest('Koi dispute khula nahi hai');
  if (String(order.dispute?.raisedBy) !== String(req.user._id)) {
    throw forbidden('Sirf dispute kholne wala wapas le sakta hai');
  }
  order.dispute.status = 'withdrawn';
  order.dispute.resolvedAt = new Date();
  order.status = order.milestones.every((m) => ['released', 'refunded'].includes(m.status)) ? 'completed' : 'active';
  order.milestones.forEach((m) => {
    if (m.payout?.status === 'on_hold' && m.payout.holdReason === 'Dispute open') {
      m.payout.status = 'due';
      m.payout.holdReason = undefined;
    }
  });
  await order.save();
  await systemLine(order, req.user._id, `Dispute wapas le liya gaya (Order ${order.orderNo}).`);
  emitOrder(order);
  res.json({ success: true, order });
}

/* ---------------- review ---------------- */

export async function reviewOrder(req, res) {
  const order = await loadOrder(req.params.id, req.user);
  if (String(order.client) !== String(req.user._id)) throw forbidden('Sirf client review de sakta hai');
  if (order.status !== 'completed') throw badRequest('Order poora hone ke baad review do');
  if (order.reviewed) throw badRequest('Review pehle hi de diya hai');
  const { rating, comment } = req.valid.body;

  const review = await Review.create({
    order: order._id,
    client: order.client,
    freelancer: order.freelancer,
    rating,
    comment,
  });
  order.reviewed = true;
  await order.save();
  await recomputeRating(order.freelancer);

  await notify(order.freelancer, {
    type: 'review_received',
    title: `${rating}★ review mila`,
    body: comment ? comment.slice(0, 140) : order.title,
    link: `/orders/${order._id}`,
  });
  res.status(201).json({ success: true, review });
}

/** Ratings ignore reviews an admin hid (PDF §14). */
export async function recomputeRating(freelancerId) {
  const id = new mongoose.Types.ObjectId(String(freelancerId));
  const [agg] = await Review.aggregate([
    { $match: { freelancer: id, hidden: false } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await FreelancerProfile.updateOne(
    { user: id },
    { ratingAvg: round2(agg?.avg || 0), ratingCount: agg?.count || 0 },
  );
  return { avg: round2(agg?.avg || 0), count: agg?.count || 0 };
}

/** Called when an order is created from a requirement (PDF §11). */
export async function closeRequirementForOrder(order) {
  if (!order.requirement) return;
  await Requirement.updateOne(
    { _id: order.requirement, status: 'open' },
    { $set: { status: 'hired', hiredOrder: order._id, closedAt: new Date() } },
  );
}
