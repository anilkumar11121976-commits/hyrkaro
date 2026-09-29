import mongoose from 'mongoose';
import { CATEGORY_SLUGS, CITY_SLUGS, REQUIREMENT_STATUS } from '../config/constants.js';

/** PDF §11: a client posts what they need; freelancers send one interest each. */
const requirementSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    category: { type: String, enum: CATEGORY_SLUGS, required: true, index: true },
    city: { type: String, enum: [...CITY_SLUGS, ''], default: '', index: true },
    remoteOk: { type: Boolean, default: true },
    budgetMin: { type: Number, min: 0, default: 0 },
    budgetMax: { type: Number, min: 0, default: 0 },
    deadline: Date,
    status: { type: String, enum: REQUIREMENT_STATUS, default: 'open', index: true },
    interestCount: { type: Number, default: 0 },
    hiredOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    closedAt: Date,
    expiresAt: Date,
  },
  { timestamps: true },
);

requirementSchema.index({ status: 1, city: 1, category: 1, createdAt: -1 });
requirementSchema.index({ title: 'text', description: 'text' });

export default mongoose.model('Requirement', requirementSchema);
