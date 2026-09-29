import crypto from 'crypto';
import { z } from 'zod';
import Payment from '../models/Payment.js';
import Order from '../models/Order.js';
import { env } from '../config/env.js';
import { getRazorpay, isRazorpayConfigured } from '../config/razorpay.js';
import { badRequest, forbidden, notFound, AppError } from '../utils/AppError.js';
import { isId } from '../utils/helpers.js';
import { notify } from '../services/notify.js';
import { createMessage, loadConversation } from './chatController.js';
import { emitOrder, loadOrder, closeRequirementForOrder } from './orderController.js';

export const verifySchema = z.object({
  paymentId: z.string().min(1),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});
export const demoConfirmSchema = z.object({ paymentId: z.string().min(1) });

const safeEqual = (a, b) => {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  return A.length === B.length && crypto.timingSafeEqual(A, B);
};

/** A stale unpaid attempt should not block a fresh one (report C3). */
const STALE_MS = 20 * 60_000;

/**
 * Idempotently mark a payment as paid and fund its milestone.
 * Report C3: if the milestone is already funded, the money is flagged for refund
 * instead of being silently swallowed.
 */
async function markPaid(payment, extra = {}) {
  if (payment.status === 'paid' || payment.status === 'refunded') return Order.findById(payment.order);

  const order = await Order.findById(payment.order);
  const ms = order?.milestones.id(payment.milestoneId);
  if (!order || !ms) {
    Object.assign(payment, extra, { status: 'paid', paidAt: new Date() });
    await payment.save();
    return order;
  }

  if (ms.status !== 'pending') {
    // Duplicate capture for an already funded milestone: keep the money visible
    // and queue it for refund rather than dropping it on the floor.
    Object.assign(payment, extra, {
      status: 'refund_pending',
      paidAt: new Date(),
      refund: {
        amount: payment.amount,
        reason: 'duplicate_payment_for_funded_milestone',
        requestedAt: new Date(),
      },
    });
    await payment.save();
    console.warn('[payment] duplicate capture queued for refund', String(payment._id));
    await notify(order.client, {
      type: 'refund_issued',
      title: 'Double payment pakda gaya',
      body: `₹${payment.amount.toLocaleString('en-IN')} do baar kat gaya tha — refund process mein hai.`,
      link: `/orders/${order._id}`,
    });
    return order;
  }

  Object.assign(payment, extra, { status: 'paid', paidAt: new Date() });
  await payment.save();

  ms.status = 'funded';
  ms.fundedAt = new Date();
  ms.payment = payment._id;
  if (order.status === 'awaiting_payment') order.status = 'active';
  await order.save();
  await closeRequirementForOrder(order);

  try {
    const conv = await loadConversation(order.conversation, order.client);
    await createMessage(conv, order.client, {
      type: 'system',
      text: `₹${ms.amount.toLocaleString('en-IN')} HyrKro ke paas safe jama hua ("${ms.title}"). Freelancer ab kaam shuru kar sakta hai.`,
    });
  } catch (e) {
    console.warn('[payment] system message failed', e.message);
  }
  await notify(order.freelancer, {
    type: 'milestone_funded',
    title: 'Paisa escrow mein aa gaya',
    body: `${ms.title} – ₹${ms.amount.toLocaleString('en-IN')}. Kaam shuru karo.`,
    link: `/orders/${order._id}`,
  });
  emitOrder(order);
  return order;
}

export async function paymentConfig(_req, res) {
  const enabled = isRazorpayConfigured();
  res.json({ success: true, mode: enabled ? 'razorpay' : 'demo', keyId: enabled ? env.razorpay.keyId : null });
}

export async function createMilestonePayment(req, res) {
  const order = await loadOrder(req.params.orderId, req.user);
  if (String(order.client) !== String(req.user._id)) throw forbidden('Sirf client payment kar sakta hai');
  if (order.status === 'awaiting_acceptance') throw badRequest('Pehle freelancer order accept kare');
  if (['cancelled', 'completed', 'refunded'].includes(order.status)) throw badRequest('Is order pe payment nahi ho sakta');
  if (order.status === 'disputed') throw badRequest('Dispute chal raha hai, pehle wo resolve ho');

  const idx = order.milestones.findIndex((m) => String(m._id) === String(req.params.msId));
  if (idx < 0) throw notFound('Milestone nahi mila');
  const ms = order.milestones[idx];
  if (ms.status !== 'pending') throw badRequest('Is milestone ka payment ho chuka hai');
  if (order.milestones.slice(0, idx).some((m) => m.status === 'pending')) throw badRequest('Pehle pichla milestone fund karo');

  const mode = isRazorpayConfigured() ? 'razorpay' : 'demo';

  /**
   * Report C3: reuse the open attempt for this milestone instead of minting a
   * second one. A unique partial index on {order, milestoneId, status:'created'}
   * backs this up even under a race.
   */
  let payment = await Payment.findOne({ order: order._id, milestoneId: ms._id, status: 'created' });
  if (payment) {
    const stale = Date.now() - new Date(payment.updatedAt).getTime() > STALE_MS;
    if (stale || payment.mode !== mode) {
      payment.status = 'expired';
      await payment.save();
      payment = null;
    }
  }
  if (!payment) {
    try {
      payment = await Payment.create({
        order: order._id,
        milestoneId: ms._id,
        client: req.user._id,
        amount: ms.amount,
        mode,
      });
    } catch (e) {
      if (e.code === 11000) {
        payment = await Payment.findOne({ order: order._id, milestoneId: ms._id, status: 'created' });
        if (!payment) throw e;
      } else throw e;
    }
  }

  if (mode === 'demo') {
    return res.status(201).json({ success: true, mode, paymentId: payment._id, amount: ms.amount });
  }

  const rzp = getRazorpay();
  if (!payment.razorpayOrderId) {
    const rzpOrder = await rzp.orders.create({
      amount: Math.round(ms.amount * 100),
      currency: 'INR',
      receipt: `${order.orderNo}-${idx + 1}`.slice(0, 40),
      notes: { orderId: String(order._id), milestoneId: String(ms._id), paymentId: String(payment._id) },
    });
    payment.razorpayOrderId = rzpOrder.id;
    await payment.save();
  }

  res.status(201).json({
    success: true,
    mode,
    paymentId: payment._id,
    keyId: env.razorpay.keyId,
    razorpayOrderId: payment.razorpayOrderId,
    amount: Math.round(ms.amount * 100),
    currency: 'INR',
    name: 'HyrKro',
    description: `${order.title} – ${ms.title}`,
    prefill: { name: req.user.name, email: req.user.email || '', contact: req.user.phone || '' },
  });
}

export async function verifyPayment(req, res) {
  if (!isRazorpayConfigured()) throw badRequest('Online payment abhi setup nahi hai');
  const { paymentId, razorpay_order_id: oid, razorpay_payment_id: pid, razorpay_signature: sig } = req.valid.body;
  if (!isId(paymentId)) throw badRequest('Galat payment');
  const payment = await Payment.findById(paymentId);
  if (!payment || String(payment.client) !== String(req.user._id)) throw notFound('Payment nahi mila');
  if (payment.razorpayOrderId !== oid) throw badRequest('Payment match nahi hua');

  const expected = crypto.createHmac('sha256', env.razorpay.keySecret).update(`${oid}|${pid}`).digest('hex');
  if (!safeEqual(expected, sig)) {
    payment.status = 'failed';
    payment.failureReason = 'signature_mismatch';
    await payment.save();
    throw badRequest('Payment verify nahi hua. Paise kate hain to 5-7 din mein wapas aa jayenge.');
  }
  const order = await markPaid(payment, { razorpayPaymentId: pid, razorpaySignature: sig });
  res.json({ success: true, order });
}

/** Used only when Razorpay keys are not configured (demo mode). */
export async function confirmDemoPayment(req, res) {
  if (isRazorpayConfigured()) throw forbidden('Demo payment band hai');
  const { paymentId } = req.valid.body;
  if (!isId(paymentId)) throw badRequest('Galat payment');
  const payment = await Payment.findById(paymentId);
  if (!payment || String(payment.client) !== String(req.user._id) || payment.mode !== 'demo') {
    throw notFound('Payment nahi mila');
  }
  const order = await markPaid(payment);
  res.json({ success: true, order, demo: true });
}

/** Admin retry for a refund Razorpay rejected the first time. */
export async function retryRefund(req, res) {
  const { paymentId } = req.params;
  if (!isId(paymentId)) throw badRequest('Galat payment');
  const payment = await Payment.findById(paymentId);
  if (!payment) throw notFound('Payment nahi mila');
  if (payment.status !== 'refund_pending') throw badRequest('Is payment pe refund pending nahi hai');

  if (!isRazorpayConfigured() || !payment.razorpayPaymentId) {
    payment.status = 'refunded';
    payment.refund.completedAt = new Date();
    await payment.save();
    return res.json({ success: true, payment, mode: 'demo' });
  }
  const rzp = getRazorpay();
  try {
    const r = await rzp.payments.refund(payment.razorpayPaymentId, {
      amount: Math.round((payment.refund?.amount || payment.amount) * 100),
      speed: 'normal',
    });
    payment.refund.razorpayRefundId = r.id;
    payment.refund.completedAt = new Date();
    payment.status = 'refunded';
    await payment.save();
    res.json({ success: true, payment });
  } catch (e) {
    payment.refund.note = e.message;
    await payment.save();
    throw new AppError(`Refund fail hua: ${e.message}`, 502);
  }
}

/** Razorpay webhook (raw body). Events: payment.captured / order.paid / payment.failed / refund.processed */
export async function razorpayWebhook(req, res) {
  if (!isRazorpayConfigured() || !env.razorpay.webhookSecret) return res.status(200).json({ ok: true, ignored: true });
  const signature = req.headers['x-razorpay-signature'];
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
  const expected = crypto.createHmac('sha256', env.razorpay.webhookSecret).update(raw).digest('hex');
  if (!signature || !safeEqual(expected, signature)) return res.status(400).json({ ok: false });

  let event;
  try {
    event = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).json({ ok: false });
  }

  const entity = event?.payload?.payment?.entity;
  if (['payment.captured', 'order.paid'].includes(event?.event) && entity?.order_id) {
    const payment = await Payment.findOne({ razorpayOrderId: entity.order_id });
    if (payment) await markPaid(payment, { razorpayPaymentId: entity.id });
  }
  if (event?.event === 'payment.failed' && entity?.order_id) {
    await Payment.updateOne(
      { razorpayOrderId: entity.order_id, status: 'created' },
      { status: 'failed', failureReason: entity.error_description || 'failed' },
    );
  }
  const refund = event?.payload?.refund?.entity;
  if (event?.event?.startsWith('refund.') && refund?.payment_id) {
    await Payment.updateOne(
      { razorpayPaymentId: refund.payment_id, status: 'refund_pending' },
      { $set: { status: 'refunded', 'refund.razorpayRefundId': refund.id, 'refund.completedAt': new Date() } },
    );
  }
  res.json({ ok: true });
}
