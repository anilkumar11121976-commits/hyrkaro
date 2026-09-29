import mongoose from 'mongoose';

/**
 * PDF §11: "Freelancer ek requirement pe ek hi baar interest bhej sakta hai
 * (roz ki limit ke saath), taaki client ko spam na mile."
 */
const interestSchema = new mongoose.Schema(
  {
    requirement: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement', required: true, index: true },
    freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, trim: true, maxlength: 1000, default: '' },
    quote: { type: Number, min: 0 },
    deliveryDays: { type: Number, min: 1, max: 365 },
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
    status: { type: String, enum: ['sent', 'shortlisted', 'declined', 'hired'], default: 'sent' },
  },
  { timestamps: true },
);

// One interest per freelancer per requirement — enforced by the database, not by a check.
interestSchema.index({ requirement: 1, freelancer: 1 }, { unique: true });
interestSchema.index({ freelancer: 1, createdAt: -1 });

export default mongoose.model('Interest', interestSchema);
