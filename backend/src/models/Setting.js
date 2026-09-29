import mongoose from 'mongoose';

/**
 * PDF §16: "Commission 5-10% category ke hisaab se admin se badla ja sakta hai,
 * code change kiye bina." One document per key, cached in memory for a minute.
 */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: mongoose.Schema.Types.Mixed,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export default mongoose.model('Setting', settingSchema);
