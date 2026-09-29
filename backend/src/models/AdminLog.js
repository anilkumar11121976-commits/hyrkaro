import mongoose from 'mongoose';

/** PDF §16: "Har admin action ka log rehta hai." */
const adminLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    adminName: String,
    action: { type: String, required: true, index: true },
    targetType: { type: String, enum: ['user', 'profile', 'order', 'payout', 'review', 'dispute', 'setting', 'requirement'] },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    summary: { type: String, maxlength: 300 },
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: true },
);

adminLogSchema.index({ createdAt: -1 });

export default mongoose.model('AdminLog', adminLogSchema);
