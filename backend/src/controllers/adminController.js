import { z } from 'zod';
import User from '../models/User.js';
import FreelancerProfile from '../models/FreelancerProfile.js';
import Order from '../models/Order.js';
import Payment from '../models/Payment.js';
import Review from '../models/Review.js';
import Waitlist from '../models/Waitlist.js';
import Requirement from '../models/Requirement.js';
import AdminLog from '../models/AdminLog.js';
import { CATEGORY_SLUGS } from '../config/constants.js';
import { commissionTable, saveCommissionSettings, getCommissionSettings } from '../services/settings.js';
import { notify } from '../services/notify.js';
import { escapeRegex, isId, paginate } from '../utils/helpers.js';
import { badRequest, notFound, forbidden } from '../utils/AppError.js';
import { refundOrderEscrow, recomputeRating, emitOrder } from './orderController.js';

/* ---------------- schemas ---------------- */

export const listUsersSchema = z.object({
  q: z.string().trim().max(80).optional(),
  role: z.enum(['client', 'freelancer', 'admin']).optional(),
  flagged: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export const verifySchema = z.object({
  status: z.enum(['verified', 'rejected']),
  note: z.string().trim().max(500).optional().default(''),
});
export const blockSchema = z.object({
  blocked: z.boolean(),
  reason: z.string().trim().max(300).optional().default(''),
});
export const payoutSchema = z.object({ reference: z.string().trim().min(2).max(120) });
export const listFreelancersSchema = z.object({
  status: z.enum(['incomplete', 'pending', 'verified', 'rejected']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export const listOrdersSchema = z.object({
  status: z
    .enum(['awaiting_acceptance', 'awaiting_payment', 'active', 'completed', 'cancelled', 'disputed', 'refunded'])
    .optional(),
  q: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export const kycDecisionSchema = z.object({
  status: z.enum(['verified', 'rejected']),
  note: z.string().trim().max(500).optional().default(''),
});
export const commissionSchema = z.object({
  free: z.coerce.number().min(0).max(30).optional(),
  pro: z.coerce.number().min(0).max(30).optional(),
  byCategory: z
    .record(z.enum(CATEGORY_SLUGS), z.object({ free: z.coerce.number().min(0).max(30), pro: z.coerce.number().min(0).max(30) }))
    .optional(),
});
export const disputeResolveSchema = z
  .object({
    outcome: z.enum(['client', 'freelancer', 'split']),
    clientPercent: z.coerce.number().min(0).max(100).optional(),
    note: z.string().trim().min(5, 'Faisle ki wajah likho').max(2000),
  })
  .refine((d) => d.outcome !== 'split' || d.clientPercent != null, {
    message: 'Split ke liye client ka percent do',
    path: ['clientPercent'],
  });
export const hideReviewSchema = z.object({
  hidden: z.boolean(),
  reason: z.string().trim().max(300).optional().default(''),
});
export const listLogsSchema = z.object({
  action: z.string().trim().max(60).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/* ---------------- audit log (PDF §16) ---------------- */

async function logAction(req, { action, targetType, targetId, summary, before, after }) {
  try {
    await AdminLog.create({
      admin: req.user._id,
      adminName: req.user.name,
      action,
      targetType,
      targetId,
      summary,
      before,
      after,
      ip: req.ip,
    });
  } catch (e) {
    console.warn('[admin] log failed:', e.message);
  }
}

/* ---------------- stats ---------------- */

export async function stats(_req, res) {
  const [
    users, clients, freelancers, pending, verified,
    kycPending, orders, active, completed, disputes,
    paidAgg, dueAgg, refundAgg, waitlist, openRequirements,
  ] = await Promise.all([
    User.countDocuments({ deletedAt: null }),
    User.countDocuments({ role: 'client', deletedAt: null }),
    User.countDocuments({ role: 'freelancer', deletedAt: null }),
    FreelancerProfile.countDocuments({ 'verification.status': 'pending' }),
    FreelancerProfile.countDocuments({ 'verification.status': 'verified' }),
    User.countDocuments({ 'kyc.status': 'pending' }),
    Order.countDocuments(),
    Order.countDocuments({ status: 'active' }),
    Order.countDocuments({ status: 'completed' }),
    Order.countDocuments({ status: 'disputed' }),
    Payment.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Order.aggregate([
      { $unwind: '$milestones' },
      { $match: { 'milestones.payout.status': { $in: ['due', 'on_hold', 'paid'] } } },
      {
        $group: {
          _id: null,
          commission: { $sum: '$milestones.payout.commission' },
          due: {
            $sum: { $cond: [{ $eq: ['$milestones.payout.status', 'due'] }, '$milestones.payout.amount', 0] },
          },
          onHold: {
            $sum: { $cond: [{ $eq: ['$milestones.payout.status', 'on_hold'] }, '$milestones.payout.amount', 0] },
          },
        },
      },
    ]),
    Payment.aggregate([
      { $match: { status: { $in: ['refunded', 'refund_pending'] } } },
      { $group: { _id: '$status', total: { $sum: '$amount' }, n: { $sum: 1 } } },
    ]),
    Waitlist.countDocuments(),
    Requirement.countDocuments({ status: 'open' }),
  ]);

  const refundBy = Object.fromEntries(refundAgg.map((r) => [r._id, r]));
  res.json({
    success: true,
    stats: {
      users, clients, freelancers,
      pendingVerification: pending,
      verifiedFreelancers: verified,
      kycPending,
      orders, activeOrders: active, completedOrders: completed,
      disputes,
      gmv: paidAgg[0]?.total || 0,
      commissionEarned: dueAgg[0]?.commission || 0,
      payoutsDue: dueAgg[0]?.due || 0,
      payoutsOnHold: dueAgg[0]?.onHold || 0,
      refunded: refundBy.refunded?.total || 0,
      refundPending: refundBy.refund_pending?.total || 0,
      waitlist,
      openRequirements,
    },
  });
}

/* ---------------- freelancer verification ---------------- */

export async function listFreelancers(req, res) {
  const q = req.valid.query;
  const { page, limit, skip } = paginate(q, { defLimit: 20, maxLimit: 100 });
  const filter = q.status ? { 'verification.status': q.status } : {};
  const [items, total] = await Promise.all([
    FreelancerProfile.find(filter)
      .sort({ 'verification.submittedAt': -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'name email phone avatar city isBlocked contactStrikes kyc.status createdAt'),
    FreelancerProfile.countDocuments(filter),
  ]);
  res.json({ success: true, items, total, page, pages: Math.ceil(total / limit) || 1 });
}

export async function setVerification(req, res) {
  const { id } = req.params;
  if (!isId(id)) throw notFound('Profile nahi mili');
  const profile = await FreelancerProfile.findById(id);
  if (!profile) throw notFound('Profile nahi mili');
  const { status, note } = req.valid.body;
  if (status === 'rejected' && !note) throw badRequest('Reject karne ki wajah likho');

  const before = profile.verification.status;
  profile.verification.status = status;
  profile.verification.note = note;
  if (status === 'verified') profile.verification.verifiedAt = new Date();
  await profile.save();

  await logAction(req, {
    action: `verification.${status}`,
    targetType: 'profile',
    targetId: profile._id,
    summary: note || `${before} -> ${status}`,
    before: { status: before },
    after: { status },
  });
  await notify(profile.user, {
    type: status === 'verified' ? 'verification_approved' : 'verification_rejected',
    title: status === 'verified' ? 'Profile verify ho gayi!' : 'Verification reject hua',
    body: status === 'verified' ? 'Ab aapki profile search mein dikhegi.' : note,
    link: '/dashboard',
  });
  res.json({ success: true, profile });
}

/* ---------------- KYC (PDF §12) ---------------- */

export async function listKyc(req, res) {
  const { page, limit, skip } = paginate(req.query, { defLimit: 20, maxLimit: 100 });
  const filter = { 'kyc.status': req.query.status || 'pending' };
  const [items, total] = await Promise.all([
    User.find(filter).select('name phone email city kyc role createdAt').sort({ 'kyc.submittedAt': -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, items, total, page, pages: Math.ceil(total / limit) || 1 });
}

export async function setKyc(req, res) {
  const { id } = req.params;
  if (!isId(id)) throw notFound('User nahi mila');
  const user = await User.findById(id);
  if (!user) throw notFound('User nahi mila');
  const { status, note } = req.valid.body;
  if (status === 'rejected' && !note) throw badRequest('Reject karne ki wajah likho');

  const before = user.kyc?.status;
  user.kyc.status = status;
  user.kyc.note = note;
  user.kyc.reviewedAt = new Date();
  await user.save({ validateBeforeSave: false });

  // Releasing KYC also releases any payout that was waiting on it.
  let released = 0;
  if (status === 'verified') {
    const orders = await Order.find({ freelancer: user._id, 'milestones.payout.status': 'on_hold' });
    for (const order of orders) {
      let touched = false;
      order.milestones.forEach((m) => {
        if (m.payout?.status === 'on_hold' && m.payout.holdReason === 'KYC pending') {
          m.payout.status = 'due';
          m.payout.holdReason = undefined;
          touched = true;
          released += 1;
        }
      });
      if (touched) await order.save();
    }
  }

  await logAction(req, {
    action: `kyc.${status}`,
    targetType: 'user',
    targetId: user._id,
    summary: note || `${before} -> ${status}${released ? `, ${released} payout released` : ''}`,
  });
  await notify(user._id, {
    type: status === 'verified' ? 'kyc_approved' : 'kyc_rejected',
    title: status === 'verified' ? 'KYC verify ho gaya' : 'KYC reject hua',
    body: status === 'verified' ? 'Ab payout aapke account mein aayega.' : note,
    link: '/settings',
  });
  res.json({ success: true, user, payoutsReleased: released });
}

/* ---------------- users ---------------- */

export async function listUsers(req, res) {
  const q = req.valid.query;
  const { page, limit, skip } = paginate(q, { defLimit: 20, maxLimit: 100 });
  const filter = {};
  if (q.role) filter.role = q.role;
  if (q.flagged) filter.contactStrikes = { $gte: 1 };
  if (q.q) {
    const rx = new RegExp(escapeRegex(q.q), 'i');
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, items, total, page, pages: Math.ceil(total / limit) || 1 });
}

export async function setBlocked(req, res) {
  const { id } = req.params;
  if (!isId(id)) throw notFound('User nahi mila');
  if (String(id) === String(req.user._id)) throw badRequest('Khud ko block nahi kar sakte');
  const target = await User.findById(id);
  if (!target) throw notFound('User nahi mila');
  if (target.role === 'admin') throw forbidden('Admin ko block nahi kar sakte');

  const { blocked, reason } = req.valid.body;
  target.isBlocked = blocked;
  target.blockReason = blocked ? reason : undefined;
  await target.save({ validateBeforeSave: false });
  await FreelancerProfile.updateOne({ user: id }, { isVisible: !blocked });

  await logAction(req, {
    action: blocked ? 'user.block' : 'user.unblock',
    targetType: 'user',
    targetId: target._id,
    summary: reason || target.name,
  });
  if (blocked) {
    await notify(target._id, {
      type: 'admin_warning',
      title: 'Account block ho gaya',
      body: reason || 'Support se baat karein.',
      link: '/settings',
    });
  }
  res.json({ success: true, user: target });
}

/* ---------------- orders, disputes, payouts ---------------- */

export async function listOrders(req, res) {
  const q = req.valid.query;
  const { page, limit, skip } = paginate(q, { defLimit: 20, maxLimit: 100 });
  const filter = {};
  if (q.status) filter.status = q.status;
  if (q.q) filter.$or = [{ orderNo: new RegExp(escapeRegex(q.q), 'i') }, { title: new RegExp(escapeRegex(q.q), 'i') }];
  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('client', 'name email phone')
      .populate('freelancer', 'name email phone'),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, items, total, page, pages: Math.ceil(total / limit) || 1 });
}

export async function listDisputes(req, res) {
  const { page, limit, skip } = paginate(req.query, { defLimit: 20, maxLimit: 100 });
  const filter = { status: 'disputed' };
  const [items, total] = await Promise.all([
    Order.find(filter)
      .sort({ 'dispute.openedAt': 1 })
      .skip(skip)
      .limit(limit)
      .populate('client', 'name phone email')
      .populate('freelancer', 'name phone email')
      .populate('dispute.raisedBy', 'name role'),
    Order.countDocuments(filter),
  ]);
  res.json({ success: true, items, total, page, pages: Math.ceil(total / limit) || 1 });
}

/** PDF §10: admin decides from chat, offer card and delivered files. */
export async function resolveDispute(req, res) {
  const { id } = req.params;
  if (!isId(id)) throw notFound('Order nahi mila');
  const order = await Order.findById(id);
  if (!order) throw notFound('Order nahi mila');
  if (order.status !== 'disputed') throw badRequest('Is order pe dispute khula nahi hai');

  const { outcome, clientPercent, note } = req.valid.body;
  const held = order.escrowHeld();
  let refunded = [];
  let releasedToFreelancer = 0;

  if (outcome === 'client') {
    refunded = await refundOrderEscrow(order, { reason: `Dispute: ${note}`, by: req.user._id });
    order.dispute.status = 'resolved_client';
    order.dispute.clientShare = held;
    order.dispute.freelancerShare = 0;
  } else if (outcome === 'freelancer') {
    // Release the held milestones to the freelancer, minus commission.
    for (const ms of order.milestones) {
      if (!['funded', 'submitted', 'changes_requested'].includes(ms.status)) continue;
      const commission = Math.round(((ms.amount * order.commissionPercent) / 100) * 100) / 100;
      ms.status = 'released';
      ms.releasedAt = new Date();
      ms.payout = {
        amount: Math.round((ms.amount - commission) * 100) / 100,
        commission,
        commissionPercent: order.commissionPercent,
        dueAt: new Date(),
        status: 'due',
      };
      releasedToFreelancer += ms.amount;
    }
    order.dispute.status = 'resolved_freelancer';
    order.dispute.clientShare = 0;
    order.dispute.freelancerShare = held;
  } else {
    // Split: refund the client's share, release the rest.
    const clientPart = Math.round((held * clientPercent) / 100);
    let toRefund = clientPart;
    for (const ms of order.milestones) {
      if (!['funded', 'submitted', 'changes_requested'].includes(ms.status)) continue;
      if (toRefund >= ms.amount) {
        toRefund -= ms.amount;
        const r = await refundOrderEscrow(order, {
          reason: `Dispute split: ${note}`,
          by: req.user._id,
          onlyMilestoneId: ms._id,
        });
        refunded.push(...r);
      } else {
        const commission = Math.round(((ms.amount * order.commissionPercent) / 100) * 100) / 100;
        ms.status = 'released';
        ms.releasedAt = new Date();
        ms.payout = {
          amount: Math.round((ms.amount - commission) * 100) / 100,
          commission,
          commissionPercent: order.commissionPercent,
          dueAt: new Date(),
          status: 'due',
        };
        releasedToFreelancer += ms.amount;
      }
    }
    order.dispute.status = 'resolved_split';
    order.dispute.clientShare = clientPart;
    order.dispute.freelancerShare = held - clientPart;
  }

  order.dispute.resolution = note;
  order.dispute.resolvedAt = new Date();
  order.dispute.resolvedBy = req.user._id;
  order.status = order.milestones.every((m) => ['released', 'refunded'].includes(m.status))
    ? refunded.length && !releasedToFreelancer
      ? 'refunded'
      : 'completed'
    : 'active';
  if (order.status === 'completed') order.completedAt = new Date();
  await order.save();

  await logAction(req, {
    action: `dispute.resolve.${outcome}`,
    targetType: 'dispute',
    targetId: order._id,
    summary: `${order.orderNo}: ${note}`.slice(0, 300),
    after: { clientShare: order.dispute.clientShare, freelancerShare: order.dispute.freelancerShare },
  });
  await notify(order.client, {
    type: 'dispute_resolved',
    title: 'Dispute ka faisla aa gaya',
    body: note.slice(0, 140),
    link: `/orders/${order._id}`,
  });
  await notify(order.freelancer, {
    type: 'dispute_resolved',
    title: 'Dispute ka faisla aa gaya',
    body: note.slice(0, 140),
    link: `/orders/${order._id}`,
  });
  emitOrder(order);
  res.json({ success: true, order, refunded, releasedToFreelancer });
}

export async function listPayouts(req, res) {
  const { page, limit, skip } = paginate(req.query, { defLimit: 50, maxLimit: 200 });
  const status = ['due', 'on_hold', 'paid'].includes(req.query.status) ? req.query.status : 'due';
  const pipeline = [
    { $unwind: '$milestones' },
    { $match: { 'milestones.payout.status': status } },
    { $sort: { 'milestones.payout.dueAt': 1 } },
    {
      $facet: {
        items: [
          { $skip: skip },
          { $limit: limit },
          { $lookup: { from: 'users', localField: 'freelancer', foreignField: '_id', as: 'fl' } },
          {
            $project: {
              orderId: '$_id',
              orderNo: 1,
              title: 1,
              milestoneId: '$milestones._id',
              milestoneTitle: '$milestones.title',
              amount: '$milestones.payout.amount',
              commission: '$milestones.payout.commission',
              dueAt: '$milestones.payout.dueAt',
              payoutStatus: '$milestones.payout.status',
              holdReason: '$milestones.payout.holdReason',
              freelancer: {
                $arrayElemAt: [
                  {
                    $map: {
                      input: '$fl',
                      as: 'f',
                      in: {
                        _id: '$$f._id',
                        name: '$$f.name',
                        email: '$$f.email',
                        phone: '$$f.phone',
                        kycStatus: '$$f.kyc.status',
                        payout: '$$f.kyc.payout',
                      },
                    },
                  },
                  0,
                ],
              },
            },
          },
        ],
        total: [{ $count: 'n' }],
      },
    },
  ];
  const [agg] = await Order.aggregate(pipeline);
  const total = agg?.total?.[0]?.n || 0;
  res.json({
    success: true,
    items: agg?.items || [],
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
    status,
  });
}

export async function markPayoutPaid(req, res) {
  const { orderId, msId } = req.params;
  if (!isId(orderId) || !isId(msId)) throw notFound('Payout nahi mila');
  const order = await Order.findById(orderId);
  const ms = order?.milestones.id(msId);
  if (!ms || ms.payout?.status !== 'due') throw notFound('Payout nahi mila ya abhi due nahi hai');

  ms.payout.status = 'paid';
  ms.payout.paidAt = new Date();
  ms.payout.reference = req.valid.body.reference;
  await order.save();

  await logAction(req, {
    action: 'payout.paid',
    targetType: 'payout',
    targetId: order._id,
    summary: `${order.orderNo} / ${ms.title} – ₹${ms.payout.amount} – ref ${req.valid.body.reference}`,
  });
  await notify(order.freelancer, {
    type: 'payout_paid',
    title: 'Payout bhej diya',
    body: `₹${ms.payout.amount.toLocaleString('en-IN')} – ref ${req.valid.body.reference}`,
    link: `/orders/${order._id}`,
  });
  res.json({ success: true });
}

/* ---------------- reviews (PDF §14) ---------------- */

export async function listReviews(req, res) {
  const { page, limit, skip } = paginate(req.query, { defLimit: 30, maxLimit: 100 });
  const filter = req.query.hidden === 'true' ? { hidden: true } : {};
  const [items, total] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('client', 'name')
      .populate('freelancer', 'name')
      .populate('order', 'orderNo title')
      .lean(),
    Review.countDocuments(filter),
  ]);
  res.json({ success: true, items, total, page, pages: Math.ceil(total / limit) || 1 });
}

export async function setReviewHidden(req, res) {
  const { id } = req.params;
  if (!isId(id)) throw notFound('Review nahi mila');
  const review = await Review.findById(id);
  if (!review) throw notFound('Review nahi mila');
  const { hidden, reason } = req.valid.body;
  if (hidden && !reason) throw badRequest('Hatane ki wajah likho');

  review.hidden = hidden;
  review.hiddenReason = hidden ? reason : undefined;
  review.hiddenBy = hidden ? req.user._id : undefined;
  review.hiddenAt = hidden ? new Date() : undefined;
  await review.save();
  const rating = await recomputeRating(review.freelancer);

  await logAction(req, {
    action: hidden ? 'review.hide' : 'review.unhide',
    targetType: 'review',
    targetId: review._id,
    summary: reason || `${review.rating}★`,
  });
  res.json({ success: true, review, rating });
}

/* ---------------- commission settings (PDF §16) ---------------- */

export async function getCommission(_req, res) {
  res.json({ success: true, ...(await commissionTable()) });
}

export async function setCommission(req, res) {
  const before = await getCommissionSettings({ fresh: true });
  const patch = req.valid.body;
  const next = {
    free: patch.free ?? before.free,
    pro: patch.pro ?? before.pro,
    byCategory: { ...(before.byCategory || {}), ...(patch.byCategory || {}) },
  };
  // An empty override object means "use the default again".
  for (const [slug, v] of Object.entries(patch.byCategory || {})) {
    if (v == null) delete next.byCategory[slug];
  }
  await saveCommissionSettings(next, req.user._id);
  await logAction(req, {
    action: 'setting.commission',
    targetType: 'setting',
    summary: `free ${before.free}->${next.free}, pro ${before.pro}->${next.pro}`,
    before,
    after: next,
  });
  res.json({ success: true, ...(await commissionTable()) });
}

/* ---------------- logs + waitlist ---------------- */

export async function listLogs(req, res) {
  const q = req.valid.query;
  const { page, limit, skip } = paginate(q, { defLimit: 50, maxLimit: 100 });
  const filter = q.action ? { action: new RegExp(escapeRegex(q.action), 'i') } : {};
  const [items, total] = await Promise.all([
    AdminLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AdminLog.countDocuments(filter),
  ]);
  res.json({ success: true, items, total, page, pages: Math.ceil(total / limit) || 1 });
}

export async function listWaitlist(req, res) {
  const { page, limit, skip } = paginate(req.query, { defLimit: 50, maxLimit: 200 });
  const [items, total] = await Promise.all([
    Waitlist.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Waitlist.countDocuments(),
  ]);
  res.json({ success: true, items, total, page, pages: Math.ceil(total / limit) || 1 });
}

export async function listRequirementsAdmin(req, res) {
  const { page, limit, skip } = paginate(req.query, { defLimit: 30, maxLimit: 100 });
  const filter = req.query.status ? { status: req.query.status } : {};
  const [items, total] = await Promise.all([
    Requirement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('client', 'name phone').lean(),
    Requirement.countDocuments(filter),
  ]);
  res.json({ success: true, items, total, page, pages: Math.ceil(total / limit) || 1 });
}
