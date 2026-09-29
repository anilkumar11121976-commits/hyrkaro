import mongoose from 'mongoose';
import { CATEGORY_SLUGS, CITY_SLUGS, RATE_UNITS } from '../config/constants.js';

const portfolioSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: String,
    resourceType: { type: String, default: 'image' },
    title: { type: String, trim: true, maxlength: 100 },
    mime: String,
  },
  { timestamps: true },
);

const profileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    title: { type: String, trim: true, maxlength: 100, default: '' },
    category: { type: String, enum: [...CATEGORY_SLUGS, ''], default: '', index: true },
    city: { type: String, enum: [...CITY_SLUGS, ''], default: '', index: true },
    /** Denormalised from CITY_REGION so the city-first ranking can sort in one query (PDF §3). */
    region: { type: String, default: '', index: true },
    area: { type: String, trim: true, maxlength: 80, default: '' },
    bio: { type: String, trim: true, maxlength: 2000, default: '' },
    skills: { type: [String], default: [] },
    languages: { type: [String], default: ['Hindi', 'English'] },
    experienceYears: { type: Number, min: 0, max: 60, default: 0 },
    // Freelancer sets own charges. No fixed packages (PDF §12).
    rate: {
      amount: { type: Number, min: 0, default: 0 },
      unit: { type: String, enum: RATE_UNITS, default: 'project' },
    },
    remoteOk: { type: Boolean, default: true },
    portfolio: { type: [portfolioSchema], default: [] },
    verification: {
      status: { type: String, enum: ['incomplete', 'pending', 'verified', 'rejected'], default: 'incomplete', index: true },
      note: String,
      submittedAt: Date,
      verifiedAt: Date,
    },
    plan: {
      type: { type: String, enum: ['free', 'pro'], default: 'free' },
      proUntil: Date,
      /** True only for the one-time signup trial, so it is never granted twice. */
      trialUsed: { type: Boolean, default: false },
      lastPaymentAt: Date,
      /** PDF §13: "Subscription na bharne pe plan Free ho jata hai, profile live rehti hai." */
      downgradedAt: Date,
    },
    foundingFreelancer: { type: Boolean, default: false },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    completedOrders: { type: Number, default: 0 },
    responseTimeHrs: { type: Number, default: 2 },
    isVisible: { type: Boolean, default: true },
    /** PDF §11: daily interest budget, reset by date. */
    interestsSentToday: { type: Number, default: 0 },
    interestsDay: { type: String, default: '' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } },
);

profileSchema.index({ title: 'text', skills: 'text', bio: 'text' }, { weights: { title: 5, skills: 4, bio: 1 } });
profileSchema.index({ city: 1, category: 1, 'verification.status': 1, ratingAvg: -1 });
profileSchema.index({ region: 1, category: 1, 'verification.status': 1 });
profileSchema.index({ 'plan.proUntil': 1 }, { sparse: true });

profileSchema.virtual('isPro').get(function isPro() {
  return this.plan?.type === 'pro' && this.plan?.proUntil && this.plan.proUntil > new Date();
});

profileSchema.virtual('completeness').get(function completeness() {
  const checks = [
    this.title,
    this.category,
    this.city,
    this.bio && this.bio.length >= 40,
    this.skills?.length >= 2,
    this.rate?.amount > 0,
    this.portfolio?.length >= 1,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
});

export default mongoose.model('FreelancerProfile', profileSchema);
