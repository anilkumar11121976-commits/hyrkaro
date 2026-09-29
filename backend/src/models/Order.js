import mongoose from 'mongoose';
import { DISPUTE_STATUS } from '../config/constants.js';

const deliveryFileSchema = new mongoose.Schema(
  { url: String, publicId: String, name: String, mime: String, resourceType: String, size: Number },
  { _id: false },
);

const milestoneSchema = new mongoose.Schema({
  title: { type: String, required: true },
  amount: { type: Number, required: true, min: 1 },
  status: {
    type: String,
    enum: ['pending', 'funded', 'submitted', 'changes_requested', 'released', 'refunded'],
    default: 'pending',
  },
  fundedAt: Date,
  submittedAt: Date,
  releasedAt: Date,
  submission: {
    note: String,
    /**
     * PDF §9: the client sees a watermarked preview first; the real files unlock
     * on approval. `files` is never sent to the client until `released`.
     */
    preview: { type: [deliveryFileSchema], default: [] },
    files: { type: [deliveryFileSchema], default: [] },
    revision: { type: Number, default: 1 },
  },
  changesNote: String,
  changeRequests: { type: Number, default: 0 },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  // Payout to freelancer (after commission)
  payout: {
    amount: Number,
    commission: Number,
    commissionPercent: Number,
    dueAt: Date,
    status: { type: String, enum: ['none', 'on_hold', 'due', 'paid'], default: 'none' },
    holdReason: String,
    paidAt: Date,
    reference: String,
  },
  refund: {
    amount: Number,
    status: { type: String, enum: ['none', 'pending', 'done'], default: 'none' },
    at: Date,
    reason: String,
  },
});

const orderSchema = new mongoose.Schema(
  {
    orderNo: { type: String, unique: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    offerMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    requirement: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement' },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 3000 },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'INR' },
    deliveryDays: Number,
    commissionPercent: { type: Number, required: true },
    clientFee: { type: Number, default: 0 },
    milestones: { type: [milestoneSchema], validate: (v) => v.length >= 1 && v.length <= 3 },

    /**
     * Report C4: an order starts as a proposal the freelancer must accept.
     * `awaiting_acceptance` -> `awaiting_payment` -> `active` -> `completed`.
     */
    status: {
      type: String,
      enum: ['awaiting_acceptance', 'awaiting_payment', 'active', 'completed', 'cancelled', 'disputed', 'refunded'],
      default: 'awaiting_acceptance',
      index: true,
    },
    acceptedAt: Date,
    declinedAt: Date,
    declineReason: String,
    completedAt: Date,
    cancelledAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelReason: String,

    // PDF §10: changes -> dispute -> refund
    dispute: {
      status: { type: String, enum: DISPUTE_STATUS },
      raisedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      milestoneId: mongoose.Schema.Types.ObjectId,
      reason: { type: String, maxlength: 2000 },
      openedAt: Date,
      resolvedAt: Date,
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      resolution: { type: String, maxlength: 2000 },
      clientShare: Number,
      freelancerShare: Number,
    },

    reviewed: { type: Boolean, default: false },
    /** PDF §5: chat + delivery files are purged this long after completion. */
    filesPurgeAt: Date,
  },
  { timestamps: true },
);

orderSchema.index({ filesPurgeAt: 1 }, { sparse: true });

orderSchema.pre('validate', function setOrderNo() {
  if (!this.orderNo) {
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    this.orderNo = `HK${Date.now().toString(36).toUpperCase()}${rand}`;
  }
});

orderSchema.methods.isMember = function isMember(userId) {
  const id = String(userId);
  return String(this.client._id || this.client) === id || String(this.freelancer._id || this.freelancer) === id;
};

/** Money still held in escrow for this order (funded but not released or refunded). */
orderSchema.methods.escrowHeld = function escrowHeld() {
  return this.milestones
    .filter((m) => ['funded', 'submitted', 'changes_requested'].includes(m.status))
    .reduce((sum, m) => sum + m.amount, 0);
};

export default mongoose.model('Order', orderSchema);
