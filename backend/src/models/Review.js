import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, maxlength: 1000 },
    /** PDF §14: "Fake ya galat reviews admin hata sakta hai." */
    hidden: { type: Boolean, default: false, index: true },
    hiddenReason: String,
    hiddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    hiddenAt: Date,
  },
  { timestamps: true },
);

export default mongoose.model('Review', reviewSchema);
