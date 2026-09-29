import mongoose from 'mongoose';

/** PDF §15: in-app notifications for every event that needs the user's attention. */
const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: [
        'verification_approved', 'verification_rejected',
        'kyc_approved', 'kyc_rejected',
        'order_created', 'order_accepted', 'order_declined', 'order_cancelled',
        'milestone_funded', 'milestone_submitted', 'milestone_approved', 'milestone_changes',
        'payout_due', 'payout_paid', 'refund_issued',
        'dispute_opened', 'dispute_resolved',
        'offer_received', 'offer_accepted', 'offer_declined',
        'meeting_proposed', 'meeting_confirmed',
        'interest_received', 'requirement_closed',
        'review_received', 'plan_expiring', 'plan_expired',
        'message', 'admin_warning',
      ],
    },
    title: { type: String, required: true, maxlength: 140 },
    body: { type: String, maxlength: 500, default: '' },
    link: { type: String, maxlength: 300, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed },
    readAt: Date,
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });
// Notifications are transient: drop them after 90 days.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });

export default mongoose.model('Notification', notificationSchema);
