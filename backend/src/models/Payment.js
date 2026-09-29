import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    milestoneId: { type: mongoose.Schema.Types.ObjectId, required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true }, // INR
    currency: { type: String, default: 'INR' },
    mode: { type: String, enum: ['razorpay', 'demo'], required: true },
    status: {
      type: String,
      enum: ['created', 'paid', 'failed', 'refund_pending', 'refunded', 'expired'],
      default: 'created',
      index: true,
    },
    razorpayOrderId: { type: String, index: true, sparse: true },
    razorpayPaymentId: String,
    razorpaySignature: String,
    paidAt: Date,
    failureReason: String,

    // Refunds (report C1 / PDF §10)
    refund: {
      amount: Number,
      reason: String,
      razorpayRefundId: String,
      requestedAt: Date,
      completedAt: Date,
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      note: String,
    },
  },
  { timestamps: true },
);

/**
 * Report C3: one open payment attempt per milestone at a time. A second "Pay"
 * click can no longer mint a second live Razorpay order for the same milestone.
 */
paymentSchema.index(
  { order: 1, milestoneId: 1 },
  { unique: true, partialFilterExpression: { status: 'created' } },
);

export default mongoose.model('Payment', paymentSchema);
