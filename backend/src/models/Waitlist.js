import mongoose from 'mongoose';

const waitlistSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    phone: { type: String, trim: true, maxlength: 15 },
    type: { type: String, enum: ['freelancer', 'client'], default: 'freelancer' },
    city: String,
    category: String,
    source: String,
  },
  { timestamps: true },
);

export default mongoose.model('Waitlist', waitlistSchema);
